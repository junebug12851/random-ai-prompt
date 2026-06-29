/**
 * Re-roll / variation engine for the single-image view. Given a saved image's sidecar it
 * regenerates a NEW image from one of the captured prompt layers and records the parent link
 * (ancestry). This is the v3 port of v1-2's re-roll (`src/loadRerollData.js`): copy a chosen
 * prompt field back into the engine and generate a fresh image, deliberately NOT reusing the
 * seed. v1-2's "variation" was a Stable-Diffusion subseed nudge; under v3's provider abstraction
 * the provider-agnostic analog is "same prompt text, fresh seed" — so re-roll/variation are gated
 * on providers that actually expose a seed (`capabilities.seed`).
 * @module gui/lib/derive
 */
import { getProvider } from "./providers/index.js";
import { generatePrompt } from "./promptEngine.js";
import { effectiveKey } from "./sessionKeys.js";
import { ingestImage } from "./output.js";
import { promptLayers, negativeLayers } from "./gallery.js";

/** The captured prompt layers a derive can draw from: the DPL recipe, the AI translation, the roll. */
export const DERIVE_SOURCES = ["dpl", "ai", "roll"];

/**
 * Whether a given source layer is present on a sidecar (so its button can be enabled).
 * @param {object} meta The sidecar.
 * @param {"dpl"|"ai"|"roll"} source The layer.
 * @returns {boolean}
 */
export function hasSource(meta, source) {
  const p = promptLayers(meta);
  if (source === "dpl") return !!p.dpl;
  if (source === "ai") return !!p.ai;
  if (source === "roll") return !!p.roll;
  return false;
}

/**
 * Whether this image's provider can re-roll / vary at all: it needs a generate adapter AND seed
 * control (a "new image" means a fresh seed). Providers without seeds (e.g. OpenAI) are locked.
 * @param {object} meta The sidecar.
 * @returns {boolean}
 */
export function canDerive(meta) {
  const prov = getProvider(meta?.provider);
  return !!(prov && prov.loadGenerate && prov.capabilities && prov.capabilities.seed);
}

/**
 * Resolve the prompt text a derive sends, from the chosen source layer:
 * - `dpl`  → re-run the DPL recipe through the engine (random tokens re-roll → new wording).
 * - `ai`   → the AI translation, verbatim (a visual variation of the same words).
 * - `roll` → the original engine roll, verbatim.
 * Returns null when that layer isn't on the sidecar.
 * @param {object} meta The sidecar.
 * @param {"dpl"|"ai"|"roll"} source The layer.
 * @param {object} settings Current app settings (word lists for a DPL re-roll).
 * @returns {?string}
 */
export function resolveDeriveText(meta, source, settings) {
  const p = promptLayers(meta);
  if (source === "dpl") {
    if (!p.dpl) return null;
    const mode = meta?.settings?.mode ?? settings?.mode;
    return generatePrompt({ ...settings, mode, prompt: p.dpl }).trim();
  }
  if (source === "ai") return p.ai ? String(p.ai) : null;
  if (source === "roll") return p.roll ? String(p.roll) : null;
  return null;
}

/**
 * Generate a derived image from a saved one and persist its sidecar (with the parent link).
 * @param {object} args
 * @param {object} args.item The source gallery item (`{ name, meta, ... }`).
 * @param {"reroll"|"variation"} args.kind Which action triggered this (recorded for the UI label).
 * @param {"dpl"|"ai"|"roll"} args.source Which prompt layer to draw from.
 * @param {object} args.settings Current app settings (BYOK key + engine word lists).
 * @param {Function} [args.onText] `(text)` — the resolved prompt, fired before the image returns.
 * @returns {Promise<{path: string, meta: object}>} The new image's served path + its sidecar.
 * @throws {Error} When the provider can't generate, lacks seeds, the layer is missing, or 0 images.
 */
export async function deriveImage({ item, kind, source, settings, onText }) {
  const meta = item?.meta || {};
  const prov = getProvider(meta.provider);
  if (!prov || !prov.loadGenerate) throw new Error("This image's provider can't generate here.");
  if (!prov.capabilities || !prov.capabilities.seed) {
    throw new Error(`${prov.label || "This provider"} doesn't support seeds.`);
  }

  const text = resolveDeriveText(meta, source, settings);
  if (!text) throw new Error("That prompt layer isn't available on this image.");
  onText?.(text);

  const neg = negativeLayers(meta).final || "";
  // Start from the parent's exact settings snapshot, then force a fresh seed — the whole point of
  // a re-roll / variation is a genuinely new image (v1-2 deliberately did NOT copy the seed).
  const childSettings = { ...(meta.settings || {}), seed: Math.floor(Math.random() * 1e15) };

  const generate = await prov.loadGenerate();
  const key = effectiveKey(prov.id, settings);
  const { images } = await generate({
    prompt: text,
    settings: { ...childSettings, negativePrompt: neg },
    key,
  });
  if (!images || !images.length) throw new Error("The provider returned no image.");

  const p = promptLayers(meta);
  const childMeta = {
    // Carry the recipe forward so the child is itself re-rollable; record what THIS image sent.
    prompt: {
      dpl: p.dpl ?? null,
      roll: text,
      ai: source === "ai" ? text : null,
      final: text,
    },
    negative: meta.negative || { dpl: null, roll: null, ai: null, final: neg || null },
    provider: meta.provider,
    providerLabel: meta.providerLabel,
    settings: childSettings,
    parent: item.name, // the ancestry link — the feed scan builds the reverse child list
    derivedKind: kind,
    derivedSource: source,
    savedAt: new Date().toISOString(),
  };
  const path = await ingestImage(images[0], childMeta);
  return { path, meta: childMeta };
}
