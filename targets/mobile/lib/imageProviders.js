/**
 * The mobile target's view of the **shared** provider registry (`targets/shared/`).
 *
 * This file used to be an 892-line **hand-port**: it re-declared all ~40 providers and
 * re-implemented their transports (`submitPoll`, `localPostJson`, `fetchWithTimeout`, a proxy
 * shim…). That existed because Metro can consume neither a Vite glob nor an fs scan, so the shared
 * registry was literally un-importable here — and because the shared transports assumed a browser
 * (a same-origin `/api/…`, plus a CORS-dodging `/api/forward` hop). Both were fixed at the source:
 * the registry is now a generated static index, and the transport is injectable. See
 * `notes/plans/de-duplication.md`.
 *
 * So this is now a thin **adapter**, not a copy. It:
 *   1. points the shared transport at the phone's reality (absolute Backend URL; call local servers
 *      directly — RN has no CORS; give `fetch` a timeout — RN's has none);
 *   2. reshapes the shared manifests into the flat `{ id, label, group, settings[], generate }`
 *      objects this UI already renders;
 *   3. preloads every provider's settings schema once at boot so the UI can stay **synchronous**
 *      (the web lazily code-splits its gear; on a phone the bundle already ships everything, so
 *      lazy-loading would buy nothing and an async UI would be strictly worse).
 *
 * The three role lists mirror the web exactly, because they're derived from the same manifests:
 *   • IMAGE_PROVIDERS   — render a picture. generate({prompt,key,settings}) -> {images:[dataUrl|url]}.
 *   • TEXT_PROVIDERS    — rewrite the prompt / keywords. rewrite({prompt,key,system,mode}) -> {text}.
 *   • UPSCALE_PROVIDERS — enlarge a saved image. upscale({image,key,settings}) -> {images:[...]}.
 * @module targets/mobile/lib/imageProviders
 */
import { providers, rewriteProviders, upscaleProviders } from "shared/index.js";
import { configureTransport } from "shared/_shared/transport/config.js";
import { callRewriteProxy } from "shared/_shared/transport/hostedProxy.js";

// The rewrite system prompts + reply cleanup are ENGINE-domain (they document DPL's own grammar),
// shared with the web — never re-stated here.
export { systemFor, cleanDplOutput } from "shared/_shared/rewriteSystem.js";

// ---------------------------------------------------------------------------------------------
// Transport — the one genuinely platform-specific piece (see _shared/transport/config.js).
// ---------------------------------------------------------------------------------------------

/** How long a single transport request may hang before we abort it (RN's fetch has no timeout). */
const FETCH_TIMEOUT_MS = 120_000;

/**
 * Point the shared transport at the phone's reality. Call at boot, and again whenever the user
 * edits the Backend URL.
 *
 * - `apiBase` — a phone has no origin, so our own `/api/…` routes need an absolute base (the user's
 *   desktop app or self-hosted server). Empty until they set one.
 * - `forward: false` — RN has no CORS, so local servers (ComfyUI / A1111 / SD.Next) are called
 *   DIRECTLY. The web's `/api/forward` hop exists only to dodge the browser's CORS; using it here
 *   would wrongly require a backend to be running.
 * @param {string} [backendUrl] The user's Backend URL (from the ⋯ menu).
 */
export function configureMobileTransport(backendUrl) {
  configureTransport({
    apiBase: backendUrl || "",
    forward: false,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
}

// ---------------------------------------------------------------------------------------------
// Settings schemas — preloaded once, then read synchronously.
// ---------------------------------------------------------------------------------------------

/** @type {Map<string, {fields: object[], defaults: object}>} id → resolved schema. */
const schemas = new Map();
const listeners = new Set();
let ready = false;

/**
 * Load every provider's settings schema and resolve its async option sources (`data.samplers()`, …)
 * into concrete arrays, so the UI can read fields + options synchronously. Idempotent.
 * @returns {Promise<void>} Resolves when every schema is cached.
 */
export async function initProviderSchemas() {
  if (ready) return;
  await Promise.all(
    providers.map(async (p) => {
      let schema = { defaults: {}, fields: [] };
      try {
        if (p.loadSettings) schema = (await p.loadSettings()) || schema;
      } catch {
        // A provider whose settings module fails to load must still LIST and stay pickable — it
        // just shows no knobs. One bad provider may never blank the whole picker.
      }
      const fields = await Promise.all(
        (schema.fields || []).map(async (f) => {
          if (!f.optionsFrom) return f;
          const source = schema.data?.[f.optionsFrom];
          try {
            const options = typeof source === "function" ? await source() : source;
            return { ...f, options: options || [] };
          } catch {
            return { ...f, options: [] };
          }
        }),
      );
      schemas.set(p.id, { defaults: schema.defaults || {}, fields });
    }),
  );
  ready = true;
  for (const fn of listeners) fn();
}

/**
 * Subscribe to schema readiness (so a mounted screen re-renders once the knobs exist).
 * @param {Function} fn Called when the schemas finish loading.
 * @returns {Function} Unsubscribe.
 */
export function onProviderSchemas(fn) {
  if (ready) fn();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @returns {boolean} True once {@link initProviderSchemas} has finished. */
export const providerSchemasReady = () => ready;

/** Reset the schema cache — tests only. */
export function _resetProviderSchemas() {
  schemas.clear();
  listeners.clear();
  ready = false;
}

/**
 * A provider's settings fields, flattened to the shape this UI renders:
 * `{ key, label, type, default, options?, min?, max?, step? }`.
 * @param {string} id The provider id.
 * @returns {object[]} The fields (empty until the schemas load).
 */
function settingsFor(id) {
  const schema = schemas.get(id);
  if (!schema) return [];
  return schema.fields.map((f) => ({ ...f, default: schema.defaults[f.key] }));
}

/**
 * A provider's default settings values.
 * @param {string} id The provider id.
 * @returns {object} `{ [key]: default }`.
 */
export function providerDefaults(id) {
  return { ...(schemas.get(id)?.defaults || {}) };
}

// ---------------------------------------------------------------------------------------------
// Manifest → mobile provider object
// ---------------------------------------------------------------------------------------------

/**
 * How the phone hands an image to an upscaler. Genuinely platform-specific (the web passes a served
 * `/api/output/...` path; the phone has a local file): ComfyUI takes a real file upload, the A1111
 * family takes base64, and everything else takes a `data:` URL.
 * @param {object} p The provider manifest.
 * @returns {"file"|"base64"|"dataurl"} The encoding this provider's upscaler expects.
 */
function upscaleMode(p) {
  if (p.id === "comfyui") return "file";
  if (p.local) return "base64";
  return "dataurl";
}

/**
 * Reshape a shared manifest into the flat object the mobile UI renders. `settings` and `serverKey`
 * are **getters** so they always reflect the schema cache (empty before {@link initProviderSchemas},
 * populated after) without the provider objects having to be rebuilt.
 * @param {object} p The provider manifest.
 * @param {object} [extra] Role-specific fields to merge in.
 * @returns {object} The mobile provider object.
 */
function adapt(p, extra = {}) {
  const out = {
    id: p.id,
    label: p.label,
    description: p.description,
    keyHint: p.keyHint || (p.needsKey ? "API key" : undefined),
    keyUrl: p.keyUrl,
    group: p.local ? "local" : "online",
    local: !!p.local,
    needsKey: !!p.needsKey,
    // Copy-prompt providers (Plain / Midjourney / NovelAI) call no API at all — "prompts only".
    copy: p.transport === "none",
    proxy: p.transport === "hosted-proxy",
    negative: !!p.capabilities?.negativePrompt,
    ...extra,
  };
  Object.defineProperty(out, "settings", { enumerable: true, get: () => settingsFor(p.id) });
  // The settings key holding the user's OWN server URL (comfyUrl / localWebuiUrl), if any.
  Object.defineProperty(out, "serverKey", {
    enumerable: true,
    get: () => (p.local ? settingsFor(p.id).find((f) => /url$/i.test(f.key))?.key : undefined),
  });
  return out;
}

/** @type {object[]} Providers that render a picture (plus the copy-prompt ones). */
export const IMAGE_PROVIDERS = providers
  // The web's rule, verbatim (Home.jsx / generateIntoGallery.js): a provider can generate iff it's
  // an `api` tier with a generate adapter. Copy-prompt providers list too — they mean "prompts only".
  .filter((p) => p.transport === "none" || (p.tier === "api" && p.loadGenerate))
  .map((p) =>
    adapt(p, {
      /**
       * Generate images. The provider's own adapter decides whether that means calling its API
       * directly or going through our proxy — exactly as on the web.
       * @param {object} args `{ prompt, key, settings, signal }`.
       * @returns {Promise<{images: string[]}>} The generated images.
       */
      generate: p.loadGenerate ? async (args) => (await p.loadGenerate())(args) : undefined,
    }),
  );

/** @type {object[]} Providers that can rewrite a prompt (auto-fix / keyword / DPL refine). */
export const TEXT_PROVIDERS = rewriteProviders().map((p) =>
  adapt(p, {
    // Picked for the TEXT role, a provider names its chat model, not its image model.
    label: p.rewriteLabel || p.label,
    /**
     * Rewrite a prompt. Mirrors the web's rule verbatim (`lib/rewrite.js`): a `browser-direct`
     * provider calls its own API with the BYOK key; anything else goes through the rewrite proxy
     * (which, on this target, is the user's Backend URL).
     * @param {object} args `{ prompt, key, system, mode, signal }`.
     * @returns {Promise<{text: string}>} The rewritten text.
     */
    rewrite: async ({ prompt, key, system, mode, signal }) => {
      if (p.transport === "browser-direct" && p.loadRewrite) {
        const fn = await p.loadRewrite();
        return fn({ prompt, key, system, mode, signal });
      }
      return callRewriteProxy({ providerId: p.id, prompt, key, mode, signal });
    },
  }),
);

/** @type {object[]} Providers that can upscale a saved image. */
export const UPSCALE_PROVIDERS = upscaleProviders()
  // The web's rule, verbatim (SingleView.jsx / ProvidersMenu.jsx).
  .filter((p) => p.capabilities?.upscale && p.loadUpscale)
  .map((p) =>
    adapt(p, {
      mode: upscaleMode(p),
      /**
       * Upscale an image.
       * @param {object} args `{ image, key, settings, signal }`.
       * @returns {Promise<{images: string[]}>} The upscaled image(s).
       */
      upscale: async (args) => (await p.loadUpscale())(args),
    }),
  );

/**
 * @param {string} id The provider id.
 * @returns {object|undefined} The image provider, or undefined.
 */
export const getImageProvider = (id) => IMAGE_PROVIDERS.find((p) => p.id === id);

/**
 * @param {string} id The provider id.
 * @returns {object|undefined} The text (rewrite) provider, or undefined.
 */
export const getTextProvider = (id) => TEXT_PROVIDERS.find((p) => p.id === id);

/**
 * @param {string} id The provider id.
 * @returns {object|undefined} The upscale provider, or undefined.
 */
export const getUpscaleProvider = (id) => UPSCALE_PROVIDERS.find((p) => p.id === id);
