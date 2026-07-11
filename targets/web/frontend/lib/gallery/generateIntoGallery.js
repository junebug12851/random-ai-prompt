/**
 * @file Generate images straight into the photo gallery from the gallery's own prompt box.
 *
 * This is the Gallery counterpart to {@link useImageBatches} (which drives the Home prompt list).
 * Home's flow builds a prompt-list UI with per-prompt image batches; the Gallery flow has no list —
 * it streams **live placeholder cells** into the grid and lets each finished image land in the feed.
 * To keep the Home path (and its perf suite) untouched, this is a small, self-contained orchestrator
 * that reuses the same primitives (the rewrite passes, the per-provider concurrency limiter, and the
 * exact sidecar `meta` shape written by `ingestImage`).
 *
 * Placeholder lifecycle: for each rolled prompt we add `batchSize` placeholders up front, generate
 * the batch behind the limiter, then drop those placeholders and reload the feed so the saved images
 * appear in their place. A run resolves when every batch has settled; the first error (if any) is
 * rethrown so the composer can surface it inline.
 */
import { rewritePrompt } from "../rewrite.js";
import { expandPromptSeeded, generatePrompt, renderWrapperPart } from "../promptEngine.js";
import { buildRoll } from "../home/buildRoll.js";
import { getDefaultWrapper } from "../wrapperStore.js";
import { ingestImage } from "../output.js";
import { effectiveKey } from "../sessionKeys.js";
import { cleanSnapshot } from "../home/snapshot.js";
import { getProvider } from "../providers/index.js";
import { flattenForProvider } from "../useProvider.js";
import { createLimiter } from "../home/useImageBatches.js";
import { effectiveConcurrency } from "../../../../shared/_shared/settings/concurrency.js";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Run the shared prose fix → keyword-translate passes over one string (best-effort; a failed pass
// falls back to the input). `run` is the (limited) runner so a big run doesn't stampede the API.
async function rewriteBoth({ providerId, text, key, useFix, useKeyword, run }) {
  let working = text;
  if (useFix) {
    const fixed = await run(() => rewritePrompt({ providerId, prompt: working, key }));
    if (fixed && fixed.trim()) working = fixed.trim();
  }
  if (useKeyword) {
    const tagged = await run(() =>
      rewritePrompt({ providerId, prompt: working, key, mode: "keyword" }),
    );
    if (tagged && tagged.trim()) working = tagged.trim();
  }
  return working;
}

/**
 * Generate images into the gallery from an effective prompt string.
 * @param {object} args
 * @param {string} args.text The effective prompt text (typed prompt or the box's random suggestion).
 * @param {object} args.settings The current app settings.
 * @param {(items: {id: string, label: string}[]) => void} args.onAddPending Add placeholder cells.
 * @param {(ids: string[]) => void} args.onRemovePending Drop placeholder cells by id.
 * @param {() => (void | Promise<void>)} args.onBatchDone Reload the feed (a finished batch landed).
 * @param {object} [args.deps] Injectable side-effecting deps (for tests): `{ ingestImage }`.
 * @returns {Promise<{ saved: number }>} Resolves once all batches settle; count of saved images.
 * @throws {Error} A friendly error when the provider can't render images, or the first batch error.
 */
export async function generateIntoGallery({
  text,
  settings,
  onAddPending,
  onRemovePending,
  onBatchDone,
  deps = {},
}) {
  const ingest = deps.ingestImage || ingestImage;
  const provider = getProvider(settings.provider);
  const canGenerate = provider?.tier === "api" && !!provider?.loadGenerate;
  if (!canGenerate) {
    throw new Error(
      "Pick an image provider (header → Providers) to generate images into the gallery.",
    );
  }

  // Flatten settings for this provider (app settings + its namespaced params + dialect mode).
  const { defaults } = provider.loadSettings ? await provider.loadSettings() : { defaults: {} };
  const flat = flattenForProvider(settings, defaults || {});

  // Frame each prompt with the active wrapper, then roll `promptCount` prompts (each with a forked
  // seed) — the same helper Home uses.
  const w =
    !settings.wrapperName || settings.wrapperName === "Default"
      ? getDefaultWrapper()
      : (settings.wrapper ?? getDefaultWrapper());
  let idc = 0;
  const { prompts: rolled } = buildRoll({
    settings,
    text,
    wrapper: w,
    mode: flat.mode,
    deps: { renderWrapperPart, generatePrompt, nextId: () => ++idc },
  });

  const hasRewriteProvider = settings.rewriteProvider && settings.rewriteProvider !== "none";
  const useFix = !!settings.autoFix && hasRewriteProvider;
  const useKeyword = !!settings.autoKeyword && hasRewriteProvider;
  const rkey = useFix || useKeyword ? effectiveKey(settings.rewriteProvider, settings) : "";

  // Two limiters, each sized to its provider's "Batch chunk size" — the image limiter bounds how
  // many batches render at once; the rewrite limiter bounds the prompt-rewrite calls.
  const imageLimiter = createLimiter(effectiveConcurrency(provider, flat));
  const rewriteProvider = hasRewriteProvider ? getProvider(settings.rewriteProvider) : null;
  const rewriteLimiter = createLimiter(
    rewriteProvider
      ? effectiveConcurrency(rewriteProvider, settings.providerParams?.[rewriteProvider.id])
      : effectiveConcurrency(provider, flat),
  );
  const runRewrite = (fn) => rewriteLimiter.run(fn);
  const batchSize = Math.max(1, Number(flat.batchSize) || 1);

  const key = effectiveKey(provider.id, settings);
  let saved = 0;
  let firstError = null;

  const jobs = rolled.map((p) => {
    const ids = Array.from({ length: batchSize }, () => uid());
    onAddPending(ids.map((id) => ({ id, label: p.text })));
    return imageLimiter.run(async () => {
      try {
        // --- Prompt: fix → keyword-translate (per the toggles). ---
        let promptRoll = p.text;
        let promptAi = null;
        let finalText = p.text;
        if ((useFix || useKeyword) && rkey) {
          const working = await rewriteBoth({
            providerId: settings.rewriteProvider,
            text: p.text,
            key: rkey,
            useFix,
            useKeyword,
            run: runRewrite,
          });
          if (working !== p.text) {
            promptRoll = p.text;
            promptAi = working;
            finalText = working;
          }
        }

        // --- Negative: roll its DPL, then AI-translate it too (when a rewrite pass is on). ---
        const negDpl = flat.negativePrompt || "";
        let negRoll = negDpl ? expandPromptSeeded(negDpl, { ...settings, mode: flat.mode }) : "";
        let negAi = null;
        if ((useFix || useKeyword) && rkey && negRoll.trim()) {
          try {
            const workingNeg = await rewriteBoth({
              providerId: settings.rewriteProvider,
              text: negRoll,
              key: rkey,
              useFix,
              useKeyword,
              run: runRewrite,
            });
            if (workingNeg !== negRoll) negAi = workingNeg;
          } catch {
            /* best-effort: fall back to the rolled negative */
          }
        }
        const negFinal = negAi || negRoll;

        const generate = await provider.loadGenerate();
        const { images } = await generate({
          prompt: finalText,
          settings: { ...flat, negativePrompt: negFinal },
          key,
        });
        const meta = {
          prompt: { dpl: p.dpl || null, roll: promptRoll, ai: promptAi, final: finalText },
          negative: {
            dpl: negDpl || null,
            roll: negRoll || null,
            ai: negAi,
            final: negFinal || null,
          },
          provider: provider.id,
          providerLabel: provider.label,
          settings: cleanSnapshot({ ...flat, negativePrompt: negFinal }),
          savedAt: new Date().toISOString(),
        };
        await Promise.all((images || []).map((img) => ingest(img, meta)));
        saved += (images || []).length;
      } catch (e) {
        if (!firstError) firstError = e;
      } finally {
        // Reveal the just-saved images FIRST (feed reload), then drop the placeholders — so a
        // finished cell never flashes empty between the two.
        try {
          await onBatchDone();
        } catch {
          /* a feed reload failure shouldn't fail the whole run */
        }
        onRemovePending(ids);
      }
    });
  });

  await Promise.allSettled(jobs);
  if (firstError) throw firstError;
  return { saved };
}
