/**
 * The provider registry — **isomorphic**: it runs unchanged under Vite (web), plain Node (CLI +
 * backend) and Metro (mobile). Every provider is a self-contained folder `targets/shared/<id>/`
 * (config + settings + presets + code + data); they're discovered through the generated static
 * index (`registry.generated.js` — see `scripts/build-provider-registry.mjs` for why neither a glob
 * nor an fs-scan can be universal). Drop a folder in and run `npm run registry`; no central edit.
 *
 * A provider manifest (its `config.js` default export) is a richer superset of the old
 * `{ id, label, local, needsKey }` shape — it also declares its `tier` (api | syntax | plain),
 * `dialect`, `transport`, and `capabilities`, and lazy-loads its `code/` and `settings.js`.
 * See `targets/shared/README` (and notes/plans/providers.md).
 *
 * **This module must stay runtime-agnostic — no `import.meta.glob`, no `import.meta.env`, no
 * `node:` imports.** Anything build-specific (the online-build gating, which only the web has) is
 * the caller's job: pass it in. That constraint is what lets all three targets share ONE registry
 * instead of each forking a copy.
 * @module targets/shared
 */
import { DIALECTS, engineModeFor } from "./_shared/dialects.js";
import { applySharedSettings, SHARED_SETTINGS } from "./_shared/settings/index.js";
import { PROVIDER_CONFIGS } from "./registry.generated.js";

/**
 * Normalize a provider manifest so it carries the shared provider settings (see
 * `_shared/settings/`) — currently the per-provider **batch chunk size** — folded into its
 * `settings.js` schema. Declared once (DRY) rather than copied into 40 provider folders, with
 * per-provider defaults. Transparent for a provider that declares its own version of a shared field,
 * and a no-op for a provider no shared setting applies to (e.g. copy-only Plain text / syntax tiers).
 * @param {object} p The provider manifest.
 * @returns {object} The manifest (with a shared-settings-augmented `loadSettings` when applicable).
 */
function normalizeProvider(p) {
  // Does any shared setting apply to this provider? If not, leave the manifest untouched.
  if (!SHARED_SETTINGS.some((s) => s.applies(p))) return p;
  const orig = p.loadSettings;
  return {
    ...p,
    loadSettings: async () =>
      applySharedSettings(orig ? await orig() : { defaults: {}, fields: [] }, p),
  };
}

/** @type {object[]} All registered provider manifests, sorted by label. */
export const providers = PROVIDER_CONFIGS.filter(Boolean)
  .map(normalizeProvider)
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * The providers usable in a given deployment.
 *
 * The **online** web build is a static site with no backend, so a provider only works there if it
 * talks straight to its API from the browser (`browser-direct`) or needs no network at all
 * (`transport: "none"`, e.g. Plain text). Local-direct and hosted-proxy providers need the desktop
 * app and are excluded (the UI shows them disabled — see ProvidersMenu).
 *
 * Every other target (desktop/local web, CLI, mobile) can reach localhost and/or a backend, so it
 * gets the full set. The flag is passed IN rather than read from `import.meta.env` so this module
 * stays runtime-agnostic (the web shim `targets/web/frontend/lib/providers/index.js` supplies it).
 * @param {boolean} [online] True for the static online web build.
 * @returns {object[]} The providers usable in that mode.
 */
export function providersFor(online = false) {
  return online ? providers.filter((p) => !p.local && p.transport !== "hosted-proxy") : providers;
}

/**
 * Resolve a provider by id against the FULL pool (an unavailable/locked provider must still resolve
 * — the UI wants to render it disabled, not silently swap it), falling back to the first entry of
 * `list` when the id is unknown.
 * @param {string} id The provider id.
 * @param {object[]} [list] The fallback pool (default: all providers).
 * @returns {object|undefined} The matching provider, or the first of `list`.
 */
export function findProvider(id, list = providers) {
  return providers.find((p) => p.id === id) || list[0];
}

/**
 * Providers that can rewrite a prompt (auto-fix / keyword-translate): browser-direct ones expose
 * `loadRewrite`; proxied ones declare `rewrite: true` (a server adapter lives in the web backend's
 * dispatch.js).
 * @param {object[]} [list] The pool to filter (default: all providers).
 * @returns {object[]} The rewrite-capable providers.
 */
export function rewriteProviders(list = providers) {
  return list.filter((p) => p.loadRewrite || p.rewrite);
}

/**
 * Providers that can upscale an image.
 * @param {object[]} [list] The pool to filter (default: all providers).
 * @returns {object[]} The upscale-capable providers.
 */
export function upscaleProviders(list = providers) {
  return list.filter((p) => p.loadUpscale || p.upscale);
}

export { DIALECTS, engineModeFor, applySharedSettings, SHARED_SETTINGS };
