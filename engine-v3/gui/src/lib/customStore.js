/**
 * Saved setting presets — the no-server equivalent of "Save Preset". Custom presets
 * (`{name: settingsPatch}`) persist through the storage layer (a file in the user-settings folder
 * locally; localStorage only online), under the `presets` namespace.
 * @module gui/lib/customStore
 */
import { getCached, setCached } from "../../storage/cache.js";

const PRESETS_NS = "presets";

/** @returns {object} The cached presets object (or `{}`). */
function read() {
  return getCached(PRESETS_NS) || {};
}
/** @param {object} obj The object to store. @returns {void} */
function write(obj) {
  setCached(PRESETS_NS, obj);
}

/**
 * @returns {object} The custom presets (`{ name: settingsPatch }`).
 */
// Custom presets: { name: settingsPatch }. Merge over settings like built-ins.
export function getCustomPresets() {
  return read();
}
/**
 * Save (or overwrite) a custom preset.
 * @param {string} name The preset name.
 * @param {object} patch The settings patch the preset applies.
 * @returns {void}
 */
export function saveCustomPreset(name, patch) {
  const o = { ...read() };
  o[name] = patch;
  write(o);
}
/**
 * Remove a custom preset.
 * @param {string} name The preset name.
 * @returns {void}
 */
export function removeCustomPreset(name) {
  const o = { ...read() };
  delete o[name];
  write(o);
}
