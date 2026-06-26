/**
 * The image-provider registry. Every provider is a self-contained folder
 * `gui/providers/<id>/` (config + settings + presets + code + data); this module
 * **auto-discovers** them by globbing each `config.js` (the same plugin pattern the
 * dynamic prompts use). Drop a folder in → it registers; no central edit.
 *
 * A provider manifest (its `config.js` default export) is a richer superset of the old
 * `{ id, label, local, needsKey }` shape — it also declares its `tier` (api | syntax |
 * plain), `dialect`, `transport`, and `capabilities`, and lazy-loads its `code/` and
 * `settings.js`. See `gui/providers/README` (and notes/plans/providers.md).
 * @module gui/providers
 */
import { DIALECTS, engineModeFor } from "./_shared/dialects.js";

// Eagerly import each provider's config so listing/metadata is synchronous; the heavy
// code (generate/format) and settings stay lazy behind the manifest's loaders.
const configs = import.meta.glob("./*/config.js", { eager: true });

/** @type {object[]} All registered provider manifests, sorted by label. */
export const providers = Object.values(configs)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.label.localeCompare(b.label));

// `online` is true when deployed (no local machine). Local-only providers are hidden.
export const ONLINE = import.meta.env.VITE_ONLINE === "true";

/**
 * @returns {object[]} Providers usable in the current mode (local-only hidden when ONLINE).
 */
export function availableProviders() {
  return ONLINE ? providers.filter((p) => !p.local) : providers;
}

/**
 * @param {string} id The provider id.
 * @returns {object|undefined} The matching provider, or the first available one.
 */
export function getProvider(id) {
  return providers.find((p) => p.id === id) || availableProviders()[0];
}

export { DIALECTS, engineModeFor };
