/**
 * @file
 * @brief Node-side provider registry — the CLI's equivalent of the SPA's Vite-glob registry
 * (`targets/shared/index.js`), which can't run under plain Node. It fs-discovers every
 * `shared/<id>/config.js` and every `shared/_shared/settings/*.js`, dynamic-imports them, and folds
 * the shared settings into each provider's schema exactly like the web registry does — so the CLI
 * sees the identical provider set and metadata the GUI sees (GUI parity). The CLI is always "local",
 * so every provider is available (nothing is gated off the way the online web build gates local /
 * hosted-proxy providers).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SHARED_ROOT } from "./paths.js";
import { DIALECTS, engineModeFor } from "../../../shared/_shared/dialects.js";

const SHARED_DIR = SHARED_ROOT;

/**
 * Dynamic-import an ESM module by absolute path and return its default export.
 * @param {string} abs Absolute file path.
 * @returns {Promise<*>} The module's default export (or null on failure).
 */
async function importDefault(abs) {
  try {
    const mod = await import(pathToFileURL(abs).href);
    return mod?.default ?? null;
  } catch {
    return null;
  }
}

let _shared = null;
/**
 * Discover + load the shared-setting descriptors (`_shared/settings/*.js`, minus index.js). Cached.
 * @returns {Promise<object[]>} The shared-setting descriptors.
 */
async function sharedSettings() {
  if (_shared) return _shared;
  const dir = path.join(SHARED_DIR, "_shared", "settings");
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (!name.endsWith(".js") || name === "index.js") continue;
    const desc = await importDefault(path.join(dir, name));
    if (desc && typeof desc.key === "string" && typeof desc.applies === "function") out.push(desc);
  }
  _shared = out;
  return out;
}

/**
 * Fold every applicable shared setting's field + default into a provider's settings schema — a Node
 * port of `_shared/settings/index.js#applySharedSettings` (that module uses Vite's `import.meta.glob`,
 * so it can't run here). Idempotent + non-destructive.
 * @param {object|null} schema The provider's `{ defaults, fields, data }` schema.
 * @param {object} provider The provider manifest.
 * @returns {Promise<object>} The augmented schema.
 */
async function applyShared(schema, provider) {
  let out = schema || { defaults: {}, fields: [] };
  for (const setting of await sharedSettings()) {
    if (!setting.applies(provider)) continue;
    const fields = out.fields || [];
    if (fields.some((f) => f.key === setting.key)) continue;
    out = {
      ...out,
      defaults: { [setting.key]: setting.defaultFor(provider), ...(out.defaults || {}) },
      fields: [...fields, setting.field(provider)],
    };
  }
  return out;
}

let _providers = null;
/**
 * Every registered provider manifest, sorted by label — discovered from `shared/<id>/config.js`.
 * Each manifest keeps its lazy `loadGenerate` / `loadSettings` / `loadRewrite` / `loadUpscale`
 * loaders (they dynamic-import their own `code/` + `settings.js`, which works fine in Node).
 * @returns {Promise<object[]>}
 */
export async function allProviders() {
  if (_providers) return _providers;
  const out = [];
  let dirs;
  try {
    dirs = fs.readdirSync(SHARED_DIR, { withFileTypes: true });
  } catch {
    dirs = [];
  }
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;
    const cfgPath = path.join(SHARED_DIR, d.name, "config.js");
    if (!fs.existsSync(cfgPath)) continue;
    const cfg = await importDefault(cfgPath);
    if (cfg && cfg.id) out.push(cfg);
  }
  out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  _providers = out;
  return out;
}

/**
 * The providers usable from the CLI. The CLI is inherently local (it has a filesystem + can reach
 * localhost + can run the in-process backend), so ALL providers are available — unlike the online web
 * build, which hides local / hosted-proxy providers.
 * @returns {Promise<object[]>}
 */
export const availableProviders = () => allProviders();

/**
 * Resolve a provider by id.
 * @param {string} id The provider id.
 * @returns {Promise<object|undefined>} The manifest, or undefined.
 */
export async function getProvider(id) {
  return (await allProviders()).find((p) => p.id === id);
}

/**
 * Providers that can rewrite a prompt (auto-fix / keyword-translate): browser-direct ones expose
 * `loadRewrite`; proxied ones declare `rewrite: true`.
 * @returns {Promise<object[]>}
 */
export async function rewriteProviders() {
  return (await allProviders()).filter((p) => p.loadRewrite || p.rewrite);
}

/**
 * Load a provider's settings schema with the shared settings folded in (defaults + fields), matching
 * the web registry's `normalizeProvider`.
 * @param {object} provider The provider manifest.
 * @returns {Promise<{defaults: object, fields: object[], data?: object}>}
 */
export async function providerSchema(provider) {
  const orig = provider.loadSettings ? await provider.loadSettings() : { defaults: {}, fields: [] };
  return applyShared(orig, provider);
}

export { DIALECTS, engineModeFor };
