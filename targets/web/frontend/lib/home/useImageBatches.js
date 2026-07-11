/**
 * @file Home image-generation state + lifecycle, as a hook. Owns the generated-prompt list
 * (each with its image batches), the in-flight image error, and the running id counter, and
 * exposes the operations the composer drives: run a batch (with the prose/keyword rewrite passes
 * and the per-image sidecar), and remove/clear images, batches, or the whole list (optionally
 * deleting the files from disk). Lifting this out of Home.jsx keeps the component a thin
 * coordinator over the palette, the composer, and this hook.
 *
 * **Scale — placeholder-first, chunked generation.** A run can add many prompts at once (e.g. 20
 * batches of 50 = 1000 prompts), each auto-firing an image batch of up to N images. To keep the UI
 * instant and stable at that scale, `makeBatch` is split in two: it adds the busy **placeholder**
 * batch (the skeletons) **synchronously** so every prompt shows "rendering…" immediately, then
 * enqueues the actual generate+ingest work behind a **per-provider concurrency limiter** (the image
 * provider's "Batch chunk size" — see shared/_shared/settings/concurrency.js; prompt-rewrite calls
 * go through a separate limiter sized to the text provider's own chunk size). So 1000 prompts × 10
 * images doesn't fire 10,000 requests at once — a bounded few run at a time and
 * the rest stream in as slots free up, with placeholders visible the whole time. Prompt rows keep a
 * stable object identity across unrelated updates (the `setPrompts` maps return the SAME object for
 * untouched rows) so a memoized {@link PromptResult} only re-renders the row that actually changed.
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { rewritePrompt } from "../rewrite.js";
import { expandPromptSeeded } from "../promptEngine.js";
import { ingestImage, isOutputFile, deleteImageFile } from "../output.js";
import { effectiveKey } from "../sessionKeys.js";
import { getProvider } from "../providers/index.js";
import { effectiveConcurrency } from "../../../../shared/_shared/settings/concurrency.js";
import { dialog } from "../dialog.js";
import { cleanSnapshot } from "./snapshot.js";

/**
 * A tiny promise concurrency limiter: `run(fn)` resolves with `fn()`'s result, but at most `max`
 * jobs execute at once — the rest queue in FIFO order and start as slots free up. No dependencies,
 * so it stays browser-safe.
 * @param {number} max Maximum concurrent jobs.
 * @returns {{run: (fn: () => Promise<any>) => Promise<any>, active: number, pending: number}}
 */
export function createLimiter(max) {
  let limit = Math.max(1, Math.floor(max) || 1);
  let active = 0;
  const queue = [];
  const pump = () => {
    // Start as many queued jobs as the current limit allows (a raised limit fills its new slots at
    // once; a lowered one just lets the extras drain naturally as running jobs finish).
    while (active < limit && queue.length) {
      const job = queue.shift();
      active++;
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return {
    run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        pump();
      });
    },
    /**
     * Change the concurrency limit live (driven by the user's "Batch chunk size" setting). Raising it
     * immediately starts more queued jobs; lowering it never interrupts running ones.
     * @param {number} next The new maximum concurrency (clamped to >= 1).
     */
    setMax(next) {
      limit = Math.max(1, Math.floor(next) || 1);
      pump();
    },
    get max() {
      return limit;
    },
    get active() {
      return active;
    },
    get pending() {
      return queue.length;
    },
  };
}

const msgs = defineMessages({
  rewriteNoKey: {
    id: "home.rewriteNoKey",
    defaultMessage: "Auto-rewrite is on but the rewrite provider has no API key (gear → Auto-fix).",
  },
  rewriteFailed: { id: "home.rewriteFailed", defaultMessage: "Auto-rewrite failed: {error}" },
  confirmDeleteImage: {
    id: "home.confirmDeleteImage",
    defaultMessage:
      "Delete this image from disk too?\n\nOK = delete the file\nCancel = just remove it from view",
  },
  confirmDeleteBatch: {
    id: "home.confirmDeleteBatch",
    defaultMessage: "Delete this batch's image files from disk too?",
  },
  confirmDeletePromptImgs: {
    id: "home.confirmDeletePromptImgs",
    defaultMessage: "Delete all of this prompt's image files from disk too?",
  },
  confirmClearAll: {
    id: "home.confirmClearAll",
    defaultMessage:
      "Clear all results — delete their {count, plural, one {# image file} other {# image files}} from disk too?",
  },
});

/**
 * Generated-prompt list + image-batch lifecycle for the Home composer.
 * @param {object} args
 * @param {object} args.settings The current app settings.
 * @param {object|null} args.provider The active image provider (or null).
 * @param {object} args.flat The flattened provider settings (app + namespaced params + dialect).
 * @returns {object} `{ prompts, setPrompts, nextId, imgError, makeBatch, removeImage,
 *   removeBatch, clearImages, clearAll }`.
 */
export function useImageBatches({ settings, provider, flat }) {
  const intl = useIntl();
  const [prompts, setPrompts] = useState([]);
  const [imgError, setImgError] = useState("");
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;
  // Latest prompts, readable from stable callbacks without stale-closure bugs (so handlers passed to
  // a memoized PromptResult don't need to change identity every render).
  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;
  // Two independent per-provider concurrency limiters, each sized by that provider's own "Batch chunk
  // size" (its provider-settings gear — see shared/_shared/settings/concurrency.js). This is what
  // keeps a huge run seamless without thrashing an API: the IMAGE limiter bounds how many image
  // batches actually generate at once (the rest wait with their placeholder already showing), and a
  // separate TEXT limiter bounds the prompt-rewrite calls — so a local ComfyUI image queue can run
  // wide while a rate-limited OpenAI rewrite stays gentle, each honouring its own limit.
  const imageChunk = effectiveConcurrency(provider, flat);
  const rewriteProvider =
    settings.rewriteProvider && settings.rewriteProvider !== "none"
      ? getProvider(settings.rewriteProvider)
      : null;
  const rewriteChunk = rewriteProvider
    ? effectiveConcurrency(rewriteProvider, settings.providerParams?.[rewriteProvider.id])
    : imageChunk;
  const limiterRef = useRef(null);
  if (!limiterRef.current) limiterRef.current = createLimiter(imageChunk);
  const rewriteLimiterRef = useRef(null);
  if (!rewriteLimiterRef.current) rewriteLimiterRef.current = createLimiter(rewriteChunk);
  useEffect(() => {
    limiterRef.current.setMax(imageChunk);
  }, [imageChunk]);
  useEffect(() => {
    rewriteLimiterRef.current.setMax(rewriteChunk);
  }, [rewriteChunk]);
  // Rewrite calls go through the text provider's own limiter (so 1000 auto-fixes don't stampede it).
  const doRewrite = (args) => rewriteLimiterRef.current.run(() => rewritePrompt(args));

  // The heavy part of a batch: the rewrite passes, the provider call, ingesting the saved images, and
  // the final state update. Runs behind the limiter — the placeholder is already on screen by now.
  async function runBatch({ promptId, batchId, text, entry0, promptDpl, promptRoll, promptAi }) {
    try {
      // Two independent rewrite passes share one text provider: prose auto-fix (`autoFix`) and
      // keyword/tag-list translation (`autoKeyword`). When both are on they chain — fix first,
      // then keyword-translate the fixed text.
      const hasRewriteProvider = settings.rewriteProvider && settings.rewriteProvider !== "none";
      const useFix = settings.autoFix && hasRewriteProvider;
      const useKeyword = settings.autoKeyword && hasRewriteProvider;
      const rkey = useFix || useKeyword ? effectiveKey(settings.rewriteProvider, settings) : "";
      if ((useFix || useKeyword) && !rkey) {
        setImgError(intl.formatMessage(msgs.rewriteNoKey));
      }

      // --- Main prompt: fix → keyword-translate (per the toggles), once per prompt, then cache. ---
      if ((useFix || useKeyword) && rkey && !entry0?.original) {
        try {
          let working = text;
          if (useFix) {
            const fixed = await doRewrite({
              providerId: settings.rewriteProvider,
              prompt: working,
              key: rkey,
            });
            if (fixed && fixed.trim()) working = fixed.trim();
          }
          if (useKeyword) {
            const tagged = await doRewrite({
              providerId: settings.rewriteProvider,
              prompt: working,
              key: rkey,
              mode: "keyword",
            });
            if (tagged && tagged.trim()) working = tagged.trim();
          }
          if (working !== text) {
            promptRoll = text;
            text = working;
            promptAi = text;
            setPrompts((ps) =>
              ps.map((x) => (x.id === promptId ? { ...x, original: promptRoll, text } : x)),
            );
          }
        } catch (e) {
          setImgError(intl.formatMessage(msgs.rewriteFailed, { error: e.message || String(e) }));
        }
      }

      // --- Negative prompt: roll its DPL, then AI-translate it too (when auto-fix is on). ---
      const negDpl = flat.negativePrompt || "";
      let negRoll = negDpl ? expandPromptSeeded(negDpl, { ...settings, mode: flat.mode }) : "";
      let negAi = null;
      if (entry0?.negRoll !== undefined) {
        // Already processed on a prior batch — reuse so we don't re-call the rewrite API.
        negRoll = entry0.negRoll;
        negAi = entry0.negAi ?? null;
      } else if ((useFix || useKeyword) && rkey && negRoll.trim()) {
        try {
          let workingNeg = negRoll;
          if (useFix) {
            const fixedNeg = await doRewrite({
              providerId: settings.rewriteProvider,
              prompt: workingNeg,
              key: rkey,
            });
            if (fixedNeg && fixedNeg.trim()) workingNeg = fixedNeg.trim();
          }
          if (useKeyword) {
            const taggedNeg = await doRewrite({
              providerId: settings.rewriteProvider,
              prompt: workingNeg,
              key: rkey,
              mode: "keyword",
            });
            if (taggedNeg && taggedNeg.trim()) workingNeg = taggedNeg.trim();
          }
          if (workingNeg !== negRoll) negAi = workingNeg;
        } catch {
          // Best-effort: a failed negative rewrite just falls back to the rolled negative.
        }
      }
      const negFinal = negAi || negRoll;
      setPrompts((ps) => ps.map((x) => (x.id === promptId ? { ...x, negRoll, negAi } : x)));

      const generate = await provider.loadGenerate();
      const key = effectiveKey(provider.id, settings);
      const { images: imgs } = await generate({
        prompt: text,
        settings: { ...flat, negativePrompt: negFinal },
        key,
      });
      // The full record of how these images were made, written as a sidecar next to each one
      // (read back by the photo gallery). The snapshot is provider-scoped (API keys, app
      // orchestration, and foreign provider params all dropped — never to disk).
      const settingsSnapshot = cleanSnapshot({ ...flat, negativePrompt: negFinal });
      const meta = {
        prompt: { dpl: promptDpl, roll: promptRoll, ai: promptAi, final: text },
        negative: {
          dpl: negDpl || null,
          roll: negRoll || null,
          ai: negAi,
          final: negFinal || null,
        },
        provider: provider.id,
        providerLabel: provider.label,
        settings: settingsSnapshot,
        savedAt: new Date().toISOString(),
      };
      // Funnel every provider's images into the central output folder, then display the saved copies.
      const saved = await Promise.all((imgs || []).map((img) => ingestImage(img, meta)));
      setPrompts((ps) =>
        ps.map((x) =>
          x.id === promptId
            ? {
                ...x,
                batches: x.batches.map((b) =>
                  b.id === batchId ? { ...b, busy: false, images: saved } : b,
                ),
              }
            : x,
        ),
      );
    } catch (e) {
      setImgError(e.message || String(e));
      setPrompts((ps) =>
        ps.map((x) =>
          x.id === promptId ? { ...x, batches: x.batches.filter((b) => b.id !== batchId) } : x,
        ),
      );
    }
  }

  // Add a fresh batch of images beneath a prompt via the active provider's generate adapter. The
  // placeholder (busy skeletons) is added **synchronously and immediately** so the UI never waits;
  // the actual generation is queued behind the limiter so a big run doesn't stampede the provider.
  // `promptText` is passed for auto-render (state may not be committed yet); manual clicks omit it.
  function makeBatch(promptId, promptText, promptDplArg) {
    const current = promptsRef.current;
    const text = promptText ?? current.find((x) => x.id === promptId)?.text;
    if (!text) return;
    const entry0 = current.find((x) => x.id === promptId);
    // Each prompt + negative is recorded in three layers in the sidecar: the DPL source, the
    // deterministic engine roll, and (when auto-fix is on) the AI translation. `final` is what
    // was actually sent. `*Arg` params carry the values for auto-render, where the just-added
    // entry isn't in committed state yet.
    const promptDpl = promptDplArg ?? entry0?.dpl ?? null;
    let promptRoll = text; // deterministic engine roll (pre-AI)
    let promptAi = null; // AI translation, or null
    let startText = text;
    if (entry0?.original) {
      // This prompt was already auto-fixed on a prior batch — reuse that mapping.
      promptRoll = entry0.original;
      promptAi = entry0.text;
      startText = entry0.text;
    }
    const batchId = nextId();
    const count = Math.max(1, Number(flat.batchSize) || 1);
    setImgError("");
    // INSTANT placeholder: the busy batch (skeletons) shows right away for every prompt in the run.
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId
          ? { ...x, batches: [{ id: batchId, busy: true, count, images: [] }, ...x.batches] }
          : x,
      ),
    );
    // Queue the real work; the limiter runs at most IMG_CONCURRENCY of these at a time.
    limiterRef.current
      .run(() =>
        runBatch({
          promptId,
          batchId,
          text: startText,
          entry0,
          promptDpl,
          promptRoll,
          promptAi,
        }),
      )
      .catch(() => {
        /* runBatch already surfaces its own errors + rolls back the placeholder */
      });
  }

  // Remove a single image — optionally deleting the file from disk.
  async function removeImage(promptId, batchId, img) {
    if (isOutputFile(img) && (await dialog.confirm({ message: intl.formatMessage(msgs.confirmDeleteImage) }))) {
      deleteImageFile(img);
    }
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId
          ? {
              ...x,
              batches: x.batches
                .map((b) =>
                  b.id === batchId ? { ...b, images: b.images.filter((i) => i !== img) } : b,
                )
                .filter((b) => b.busy || b.images.length),
            }
          : x,
      ),
    );
  }

  // Remove a whole batch — optionally deleting its files from disk.
  async function removeBatch(promptId, batchId) {
    const b = promptsRef.current.find((x) => x.id === promptId)?.batches.find((y) => y.id === batchId);
    const imgs = b?.images || [];
    if (imgs.some(isOutputFile) && (await dialog.confirm({ message: intl.formatMessage(msgs.confirmDeleteBatch) }))) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId ? { ...x, batches: x.batches.filter((y) => y.id !== batchId) } : x,
      ),
    );
  }

  // Clear all of a prompt's images — optionally deleting from disk.
  async function clearImages(promptId) {
    const imgs = (promptsRef.current.find((x) => x.id === promptId)?.batches || []).flatMap((b) => b.images);
    if (imgs.some(isOutputFile) && (await dialog.confirm({ message: intl.formatMessage(msgs.confirmDeletePromptImgs) }))) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts((ps) => ps.map((x) => (x.id === promptId ? { ...x, batches: [] } : x)));
  }

  // All on-disk image files across a list of prompt results.
  const allImagesOf = (list) =>
    (list || []).flatMap((p) => p.batches.flatMap((b) => b.images)).filter(isOutputFile);

  // Clear every result — optionally deleting all their image files from disk.
  async function clearAll() {
    const imgs = allImagesOf(promptsRef.current);
    if (imgs.length && (await dialog.confirm({ message: intl.formatMessage(msgs.confirmClearAll, { count: imgs.length }) }))) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts([]);
  }

  return {
    prompts,
    setPrompts,
    nextId,
    imgError,
    makeBatch,
    removeImage,
    removeBatch,
    clearImages,
    clearAll,
  };
}
