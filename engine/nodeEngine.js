/**
 * @file
 * @brief The shared **Node** engine bootstrap — wires the framework-agnostic prompt engine
 * (`createEngine`) to the Node filesystem loader (`nodeLoader`) and the suggestion catalog
 * (`promptFilesAndSuggestions`), the exact path the smoke test uses. One boot, shared by every Node
 * consumer so there's no re-ported bootstrap:
 *
 *   - the CLI (`targets/cli/src/lib/engine.js` re-exports from here),
 *   - the local backend's `/api/prompt` + `/api/prompt/catalog` routes (`targets/web/backend/apiHandler.js`).
 *
 * It is Node-only (it imports `nodeLoader`, which uses `fs` + `createRequire`); the browser SPA has its
 * own loader path (`targets/web/frontend/lib/promptEngine.js`). The engine + suggestion catalog read the
 * live settings (for NSFW gating / cleanup) via {@link setActiveSettings}. Booting is idempotent.
 */
import { createEngine } from "./core/engine.js";
import { nodeLoader } from "./core/nodeLoader.js";
import promptFiles from "./promptFilesAndSuggestions.js";
import baseSettings from "./settings.js";

let engine = null;
let booted = false;
let active = null; // the settings the current run is generating with (for NSFW gating / cleanup)

/**
 * Set the settings the suggestion builder / cleanup should read for gating (notably `includeAdult`).
 * Call before generating so NSFW gating honours the run's settings.
 * @param {object} settings The effective settings.
 * @returns {void}
 */
export function setActiveSettings(settings) {
  active = settings;
}

/**
 * Boot the engine + suggestion catalog once (idempotent). The suggestion builder reads the live
 * settings (for NSFW gating) via {@link setActiveSettings}.
 * @returns {{expand: Function, generate: Function, generateWithSeed: Function, generateMany: Function}}
 */
export function bootNodeEngine() {
  if (!booted) {
    promptFiles.configure(nodeLoader);
    promptFiles.init(() => ({
      settings: active || baseSettings,
      imageSettings: {},
      upscaleSettings: {},
    }));
    promptFiles.loadAll();
    engine = createEngine(nodeLoader);
    booted = true;
  }
  return engine;
}

/** @returns {object} The engine's default settings (engine/settings.js). */
export const engineDefaults = () => baseSettings;

/** @returns {string[]} Every block generator name (natural sort). */
export function blockNames() {
  bootNodeEngine();
  return nodeLoader.blockNames();
}

/** @returns {string[]} Every list name (logical names + implied groups). */
export function listNames() {
  bootNodeEngine();
  return nodeLoader.listNames();
}

/**
 * The block generator names to suggest/complete, honouring adult gating via the suggestion builder's
 * classification (user-submitted + excluded generators are kept out of the random pool but still
 * shown here for reference).
 * @returns {string[]} Block token names.
 */
export function blockTokens() {
  bootNodeEngine();
  return promptFiles.loadBlockList().all;
}

/**
 * The picker-facing list names (honouring the current adult flag).
 * @returns {string[]} List names for the `{name}` reference.
 */
export function pickerLists() {
  bootNodeEngine();
  return promptFiles.pickerListNames();
}

export { nodeLoader };
