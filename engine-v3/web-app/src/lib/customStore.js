/**
 * Browser-local "saved" content — the no-server equivalent of the old "Save as
 * Expansion" / "Save Preset". Custom expansions (`{name: text}`, usable as `<name>`)
 * and custom presets (`{name: settingsPatch}`) live in localStorage only.
 * @module web-app/lib/customStore
 */
// Browser-local "saved" content — the no-server equivalent of the old
// "Save as Expansion" / "Save Preset". Everything lives in localStorage only.

const EXP_KEY = "rap.customExpansions.v1";
const PRESET_KEY = "rap.customPresets.v1";

/**
 * @param {string} key The localStorage key.
 * @returns {object} The parsed object (or `{}` on miss / parse error).
 */
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
/**
 * @param {string} key The localStorage key.
 * @param {object} obj The object to store.
 * @returns {void}
 */
function write(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // best-effort
  }
}

/**
 * @returns {object} The custom expansions (`{ name: text }`, usable as `<name>`).
 */
// Custom expansions: { name: text }. Usable as <name> in prompts.
export function getCustomExpansions() {
  return read(EXP_KEY);
}
/**
 * Save (or overwrite) a custom expansion.
 * @param {string} name The expansion name.
 * @param {string} text The expansion text.
 * @returns {void}
 */
export function saveCustomExpansion(name, text) {
  const o = read(EXP_KEY);
  o[name] = text;
  write(EXP_KEY, o);
}
/**
 * Remove a custom expansion.
 * @param {string} name The expansion name.
 * @returns {void}
 */
export function removeCustomExpansion(name) {
  const o = read(EXP_KEY);
  delete o[name];
  write(EXP_KEY, o);
}

/**
 * @returns {object} The custom presets (`{ name: settingsPatch }`).
 */
// Custom presets: { name: settingsPatch }. Merge over settings like built-ins.
export function getCustomPresets() {
  return read(PRESET_KEY);
}
/**
 * Save (or overwrite) a custom preset.
 * @param {string} name The preset name.
 * @param {object} patch The settings patch the preset applies.
 * @returns {void}
 */
export function saveCustomPreset(name, patch) {
  const o = read(PRESET_KEY);
  o[name] = patch;
  write(PRESET_KEY, o);
}
/**
 * Remove a custom preset.
 * @param {string} name The preset name.
 * @returns {void}
 */
export function removeCustomPreset(name) {
  const o = read(PRESET_KEY);
  delete o[name];
  write(PRESET_KEY, o);
}
