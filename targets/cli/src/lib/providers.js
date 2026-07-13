/**
 * @file
 * @brief The CLI's view of the shared provider registry (`targets/shared/`).
 *
 * This used to be a **re-port**: the registry discovered providers with a Vite `import.meta.glob`,
 * which can't run under plain Node, so the CLI fs-scanned `shared/<id>/config.js` itself and
 * duplicated `applySharedSettings` — a second copy of the registry that could silently drift from
 * the web's. The registry is now runtime-agnostic (it discovers providers through the generated
 * static index, `targets/shared/registry.generated.js`), so the CLI simply **imports it**. One
 * registry, no drift, no parity check needed.
 *
 * The only CLI-specific bit is the async facade: the CLI's call sites are async, and the CLI is
 * inherently local (it has a filesystem, can reach localhost, and can run the backend in-process),
 * so ALL providers are available — unlike the online web build, which gates local / hosted-proxy
 * providers off.
 */
import {
  providers,
  findProvider,
  rewriteProviders as sharedRewriteProviders,
  applySharedSettings,
  DIALECTS,
  engineModeFor,
} from "../../../shared/index.js";

/**
 * Every registered provider manifest, sorted by label. Each keeps its lazy `loadGenerate` /
 * `loadSettings` / `loadRewrite` / `loadUpscale` loaders (they dynamic-import their own `code/` +
 * `settings.js`, which works fine in Node).
 * @returns {Promise<object[]>} The provider manifests.
 */
export async function allProviders() {
  return providers;
}

/**
 * The providers usable from the CLI — all of them (see the file header).
 * @returns {Promise<object[]>} The provider manifests.
 */
export const availableProviders = () => allProviders();

/**
 * Resolve a provider by id.
 * @param {string} id The provider id.
 * @returns {Promise<object|undefined>} The manifest, or undefined.
 */
export async function getProvider(id) {
  return providers.find((p) => p.id === id);
}

/**
 * Providers that can rewrite a prompt (auto-fix / keyword-translate): browser-direct ones expose
 * `loadRewrite`; proxied ones declare `rewrite: true`.
 * @returns {Promise<object[]>} The rewrite-capable providers.
 */
export async function rewriteProviders() {
  return sharedRewriteProviders();
}

/**
 * Load a provider's settings schema with the shared settings folded in (defaults + fields).
 *
 * The registry already wraps `loadSettings` with {@link applySharedSettings} for every provider a
 * shared setting applies to, so this is just `loadSettings()` with a safe default — the explicit
 * fold is kept as a belt-and-braces no-op (it's idempotent) for a manifest handed in from elsewhere.
 * @param {object} provider The provider manifest.
 * @returns {Promise<{defaults: object, fields: object[], data?: object}>} The settings schema.
 */
export async function providerSchema(provider) {
  const schema = provider.loadSettings
    ? await provider.loadSettings()
    : { defaults: {}, fields: [] };
  return applySharedSettings(schema, provider);
}

export { findProvider, DIALECTS, engineModeFor };
