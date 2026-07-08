/**
 * @file
 * @brief Per-prompt provider orchestration for the CLI — the Node analogue of the SPA's
 * `useImageBatches.runBatch`. For an `api`-tier provider it runs the optional auto-fix / keyword
 * rewrite passes, rolls + optionally rewrites the negative prompt, calls the provider's own
 * `code/generate.js`, and ingests every image into the shared `output/` folder with the SAME sidecar
 * the GUI writes (so images land in the one gallery). For a copy-only provider (`plain` / `novelai` /
 * `midjourney`) there's no image — it returns the dialect-formatted prompt text to print/copy. This
 * reuses each provider's real adapter verbatim (via the in-process backend + fetch shim), so the CLI
 * stays in lockstep with the GUI.
 */
import { getProvider, providerSchema, engineModeFor } from "./providers.js";
import { expandPromptSeeded } from "./promptRun.js";
import { rewritePrompt } from "./rewrite.js";
import { getKey } from "./keys.js";
import * as store from "./store.js";
import { cleanSnapshot } from "../../../web/frontend/lib/home/snapshot.js";

/**
 * Flatten settings for a provider exactly like the GUI's `flattenForProvider`: app settings, then the
 * provider's schema defaults, then the user's saved per-provider params, then the dialect `mode`.
 * @param {object} settings The effective settings.
 * @param {object} provider The provider manifest.
 * @returns {Promise<object>} The flattened settings the adapter reads.
 */
export async function flattenForProvider(settings, provider) {
  const schema = provider.loadSettings ? await providerSchema(provider) : { defaults: {} };
  const params =
    store.read(`providers/${provider.id}`) || settings.providerParams?.[provider.id] || {};
  return {
    ...settings,
    ...(schema.defaults || {}),
    ...params,
    mode: engineModeFor(provider.dialect),
  };
}

/**
 * Run the (optional) rewrite passes on a text — prose auto-fix then keyword-translate, chained when
 * both are on. Returns the possibly-rewritten text and whether it changed.
 * @param {string} text The input text.
 * @param {object} settings The effective settings (`rewriteProvider`, `autoFix`, `autoKeyword`).
 * @returns {Promise<{text: string, changed: boolean}>}
 */
async function applyRewrites(text, settings) {
  const hasProvider = settings.rewriteProvider && settings.rewriteProvider !== "none";
  const useFix = settings.autoFix && hasProvider;
  const useKeyword = settings.autoKeyword && hasProvider;
  if (!useFix && !useKeyword) return { text, changed: false };
  const rkey = getKey(settings.rewriteProvider);
  if (!rkey)
    throw new Error(
      "Auto-rewrite is on but the rewrite provider has no API key (prompt keys set).",
    );
  let working = text;
  if (useFix) {
    const fixed = await rewritePrompt({
      providerId: settings.rewriteProvider,
      prompt: working,
      key: rkey,
    });
    if (fixed && fixed.trim()) working = fixed.trim();
  }
  if (useKeyword) {
    const tagged = await rewritePrompt({
      providerId: settings.rewriteProvider,
      prompt: working,
      key: rkey,
      mode: "keyword",
    });
    if (tagged && tagged.trim()) working = tagged.trim();
  }
  return { text: working, changed: working !== text };
}

/**
 * Save one image source into the shared output folder with its sidecar (POST /api/image on the
 * in-process backend). Returns the served path or the original source on failure.
 * @param {string} src A `data:` URL or localhost image URL.
 * @param {object} meta The sidecar metadata.
 * @returns {Promise<string>} The saved `/api/output/<file>` path (or `src`).
 */
async function ingestImage(src, meta) {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta ? { src, meta } : { src }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.path) return data.path;
  } catch {
    // fall through
  }
  return src;
}

/**
 * Produce the provider's output for one rolled prompt.
 *   - copy tier (`plain`/`novelai`/`midjourney`): `{ copy: true, text }` (dialect-formatted).
 *   - api tier: `{ copy: false, text, images: [savedPaths], meta }`.
 * @param {object} args
 * @param {string} args.prompt The rolled prompt text (already in the provider's dialect).
 * @param {string} args.promptDpl The prompt template the roll came from (for the sidecar).
 * @param {object} args.settings The effective settings.
 * @param {object} args.provider The provider manifest.
 * @returns {Promise<object>} The result.
 */
export async function runProvider({ prompt, promptDpl, settings, provider }) {
  const flat = await flattenForProvider(settings, provider);

  // --- Copy-only providers: no image, just the dialect-formatted prompt. ---
  if (provider.tier !== "api") {
    let text = prompt;
    if (provider.loadFormat) {
      const format = await provider.loadFormat();
      const params = store.read(`providers/${provider.id}`) || {};
      text = format(prompt, params);
    }
    return { copy: true, text, images: [], provider: provider.id };
  }

  // --- Main prompt rewrite passes (auto-fix / keyword). ---
  const roll = prompt;
  const { text: finalPrompt, changed } = await applyRewrites(prompt, settings);
  const promptAi = changed ? finalPrompt : null;

  // --- Negative prompt: roll its DPL, then optionally rewrite it too. ---
  const negDpl = flat.negativePrompt || "";
  let negRoll = negDpl ? expandPromptSeeded(negDpl, { ...settings, mode: flat.mode }) : "";
  let negAi = null;
  if ((settings.autoFix || settings.autoKeyword) && negRoll.trim()) {
    try {
      const { text: negFixed, changed: negChanged } = await applyRewrites(negRoll, settings);
      if (negChanged) negAi = negFixed;
    } catch {
      // best-effort — a failed negative rewrite falls back to the rolled negative
    }
  }
  const negFinal = negAi || negRoll;

  const key = getKey(provider.id);
  if (provider.needsKey && !key) {
    throw new Error(
      `Provider "${provider.id}" needs an API key. Set one with: prompt keys set ${provider.id} <key>`,
    );
  }

  const generate = await provider.loadGenerate();
  const { images } = await generate({
    prompt: finalPrompt,
    settings: { ...flat, negativePrompt: negFinal },
    key,
  });

  const meta = {
    prompt: { dpl: promptDpl || null, roll, ai: promptAi, final: finalPrompt },
    negative: { dpl: negDpl || null, roll: negRoll || null, ai: negAi, final: negFinal || null },
    provider: provider.id,
    providerLabel: provider.label,
    settings: cleanSnapshot({ ...flat, negativePrompt: negFinal }),
    savedAt: new Date().toISOString(),
    source: "cli",
  };
  const saved = [];
  for (const img of images || []) saved.push(await ingestImage(img, meta));
  return { copy: false, text: finalPrompt, images: saved, provider: provider.id, meta };
}

/**
 * AI-upscale a saved image via a provider's upscale path (through the backend `/api/upscale` proxy),
 * saving the result into the output folder. Mirrors the GUI's upscale action.
 * @param {object} args
 * @param {string} args.providerId The upscale provider id.
 * @param {string} args.image A `/api/output/<file>` path, a bare filename, or a `data:` URL.
 * @param {object} [args.params] Provider upscale params.
 * @returns {Promise<string[]>} The saved output paths.
 */
export async function upscaleImage({ providerId, image, params }) {
  const provider = await getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider "${providerId}".`);
  const key = getKey(providerId);
  if (provider.needsKey && !key) {
    throw new Error(
      `Provider "${providerId}" needs an API key. Set one with: prompt keys set ${providerId} <key>`,
    );
  }
  const res = await fetch("/api/upscale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, image, key, params: params || {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upscale failed (${res.status})`);
  const saved = [];
  for (const img of data.images || []) saved.push(await ingestImage(img, null));
  return saved;
}
