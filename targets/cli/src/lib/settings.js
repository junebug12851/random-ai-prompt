/**
 * @file
 * @brief The CLI settings model. Mirrors the GUI's settings shape (prompt knobs match the engine;
 * image params are read by the providers) so the CLI, engine, and GUI stay in parity. Layered merge:
 *   engine defaults  →  app/provider defaults  →  active provider's schema defaults
 *   →  persisted CLI config (user/settings/cli)  →  shared GUI settings (optional)  →  presets
 *   →  per-command flag overrides.
 * Later layers win. Persisted CLI config lives in its own `cli` namespace so the CLI never clobbers
 * the GUI's `settings.json`; BYOK keys are read from BOTH the CLI store and the shared GUI store.
 */
import { engineDefaults } from "./engine.js";
import * as store from "./store.js";

/** The CLI's persisted-config namespace (its own file — never clobbers the GUI's `settings`). */
export const CLI_NS = "cli";
/** The GUI's settings namespace — read (not written) so GUI-saved keys/settings can be shared. */
export const GUI_NS = "settings";

/**
 * App/provider defaults that live outside the engine (the GUI keeps these in `defaultSettings`). Kept
 * here in lockstep with `targets/web/frontend/lib/settings.js` so CLI and GUI behave identically.
 * @constant {object}
 */
export const APP_DEFAULTS = {
  // Content rating — SFW by default, like the GUI + engine.
  includeAdult: false,

  // Generation / providers. Plain text needs no machine/key/network, so it's the safe default.
  generateImages: false,
  provider: "plain",
  localWebuiUrl: "http://127.0.0.1:7860",

  // Auto-fix (prompt rewrite before image gen). "none" = off.
  rewriteProvider: "none",
  autoFix: false,
  autoKeyword: false,

  // Image params (read by the provider adapters).
  sampler: "Euler",
  imageSteps: 32,
  imageWidth: 512,
  imageHeight: 512,
  cfg: 11,
  seed: -1,
  batchSize: 1,
  restoreFaces: false,
  negativePrompt: "",

  // Provider knobs sometimes referenced directly by adapters.
  model: "",
  size: "",
};

/**
 * The layered effective settings for a run.
 * @param {object} [opts]
 * @param {boolean} [opts.shareGui=true] Fold the GUI's saved settings (and its `keys`) in.
 * @param {object[]} [opts.presets=[]] Preset objects (`{settings,imageSettings,upscaleSettings}`),
 *   applied in order after config and before flags.
 * @param {object} [opts.overrides={}] Per-command flag overrides (highest precedence).
 * @returns {object} The merged settings object.
 */
export function effectiveSettings({ shareGui = true, presets = [], overrides = {} } = {}) {
  const cliCfg = store.read(CLI_NS) || {};
  const guiCfg = shareGui ? store.read(GUI_NS) || {} : {};

  // Merge keys from both stores (shared with the GUI). CLI-stored keys win over GUI-stored ones.
  const keys = { ...(guiCfg.keys || {}), ...(cliCfg.keys || {}) };

  let merged = {
    ...engineDefaults(),
    ...APP_DEFAULTS,
    ...(shareGui ? stripKeys(guiCfg) : {}),
    ...stripKeys(cliCfg),
  };

  // Presets carry the legacy {settings, imageSettings, upscaleSettings} shape — flatten + map.
  for (const p of presets) merged = applyPreset(merged, p);

  merged = { ...merged, ...overrides, keys };
  return merged;
}

/**
 * A settings blob with the `keys` map removed (keys are merged separately with cross-store priority).
 * @param {object} cfg A stored config blob.
 * @returns {object} The blob without `keys`.
 */
function stripKeys(cfg) {
  if (!cfg || typeof cfg !== "object") return {};
  const { keys: _drop, providerParams: _pp, ...rest } = cfg;
  return rest;
}

/**
 * Apply a preset's legacy-shaped object onto flat settings. `preset.settings` merges flat; the
 * legacy `imageSettings` / `upscaleSettings` sub-objects are mapped onto the current flat keys the
 * providers read (width→imageWidth, height→imageHeight, steps→imageSteps, negativePrompt, seed, cfg).
 * @param {object} base The current flat settings.
 * @param {object} preset A preset object.
 * @returns {object} The merged settings.
 */
export function applyPreset(base, preset) {
  if (!preset || typeof preset !== "object") return base;
  const out = { ...base, ...(preset.settings || {}) };
  const img = preset.imageSettings || {};
  const map = {
    width: "imageWidth",
    height: "imageHeight",
    steps: "imageSteps",
    cfg: "cfg",
    seed: "seed",
    sampler: "sampler",
    negativePrompt: "negativePrompt",
    batchSize: "batchSize",
    restoreFaces: "restoreFaces",
  };
  for (const [from, to] of Object.entries(map)) {
    if (img[from] !== undefined) out[to] = img[from];
  }
  // Upscale settings pass through untouched (the CLI's upscale command reads them by their own keys).
  if (preset.upscaleSettings)
    out.upscaleSettings = { ...(base.upscaleSettings || {}), ...preset.upscaleSettings };
  return out;
}

/**
 * Read the persisted CLI config blob (its own namespace).
 * @returns {object} The stored CLI config (or `{}`).
 */
export const readConfig = () => store.read(CLI_NS) || {};

/**
 * Persist the CLI config blob (atomic).
 * @param {object} cfg The full config to write.
 * @returns {boolean} True on success.
 */
export const writeConfig = (cfg) => store.write(CLI_NS, cfg);
