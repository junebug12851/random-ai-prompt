// Browser-local "saved" content — the no-server equivalent of the old
// "Save as Expansion" / "Save Preset". Everything lives in localStorage only.

const EXP_KEY = "rap.customExpansions.v1";
const PRESET_KEY = "rap.customPresets.v1";

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
function write(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // best-effort
  }
}

// Custom expansions: { name: text }. Usable as <name> in prompts.
export function getCustomExpansions() {
  return read(EXP_KEY);
}
export function saveCustomExpansion(name, text) {
  const o = read(EXP_KEY);
  o[name] = text;
  write(EXP_KEY, o);
}
export function removeCustomExpansion(name) {
  const o = read(EXP_KEY);
  delete o[name];
  write(EXP_KEY, o);
}

// Custom presets: { name: settingsPatch }. Merge over settings like built-ins.
export function getCustomPresets() {
  return read(PRESET_KEY);
}
export function saveCustomPreset(name, patch) {
  const o = read(PRESET_KEY);
  o[name] = patch;
  write(PRESET_KEY, o);
}
export function removeCustomPreset(name) {
  const o = read(PRESET_KEY);
  delete o[name];
  write(PRESET_KEY, o);
}
