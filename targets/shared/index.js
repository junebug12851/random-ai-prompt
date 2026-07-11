/**
 * The image-provider registry. Every provider is a self-contained folder
 * `gui/providers/<id>/` (config + settings + presets + code + data); this module
 * **auto-discovers** them by globbing each `config.js` (the same plugin pattern the
 * blocks use). Drop a folder in → it registers; no central edit.
 *
 * A provider manifest (its `config.js` default export) is a richer superset of the old
 * `{ id, label, local, needsKey }` shape — it also declares its `tier` (api | syntax |
 * plain), `dialect`, `transport`, and `capabilities`, and lazy-loads its `code/` and
 * `settings.js`. See `gui/providers/README` (and notes/plans/providers.md).
 * @module gui/providers
 */
import { DIALECTS, engineModeFor } from "./_shared/dialects.js";
import { applySharedSettings, SHARED_SETTINGS } from "./_shared/settings/index.js";

// Eagerly import each provider's config so listing/metadata is synchronous; the heavy
// code (generate/format) and settings stay lazy behind the manifest's loaders.
const configs = import.meta.glob("./*/config.js", { eager: true });

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
export const providers = Object.values(configs)
  .map((m) => m.default)
  .filter(Boolean)
  .map(normalizeProvider)
  .sort((a, b) => a.label.localeCompare(b.label));

// `online` is true when deployed (no local machine). Local-only providers are hidden.
export const ONLINE = import.meta.env.VITE_ONLINE === "true";

/**
 * Providers usable in the current mode. The online build is a static site with no backend, so a
 * provider only works there if it talks straight to its API from the browser (`browser-direct`) or
 * needs no network at all (`transport: "none"`, e.g. Plain text). Local-direct and hosted-proxy
 * providers need the desktop app and are excluded (the UI shows them disabled — see ProvidersMenu).
 * @returns {object[]} The providers usable in the current mode.
 */
export function availableProviders() {
  return ONLINE ? providers.filter((p) => !p.local && p.transport !== "hosted-proxy") : providers;
}

/**
 * @param {string} id The provider id.
 * @returns {object|undefined} The matching provider, or the first available one.
 */
export function getProvider(id) {
  return providers.find((p) => p.id === id) || availableProviders()[0];
}

/**
 * @returns {object[]} Providers that can rewrite a prompt (auto-fix): browser-direct ones expose
 *   `loadRewrite`; proxied ones declare `rewrite: true` (a server adapter lives in server/dispatch.js).
 */
export function rewriteProviders() {
  return providers.filter((p) => p.loadRewrite || p.rewrite);
}

export { DIALECTS, engineModeFor };
