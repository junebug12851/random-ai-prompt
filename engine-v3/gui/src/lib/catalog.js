/**
 * Back-compat re-export of the building blocks / presets / lists (now sourced from
 * `promptEngine.js`, the engine facade).
 * @module gui/lib/catalog
 */
// Back-compat re-export. The catalog now lives in promptEngine.js (the engine
// facade), so blocks/presets/lists stay in sync with the engine + custom store.
export { getBlocks, getPresetNames, loadPreset, getListNames } from "./promptEngine.js";
