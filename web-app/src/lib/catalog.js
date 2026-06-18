import { browserLoader } from "../../../core/browserLoader.js";

// Turns the loader's catalog into UI-friendly insertable tokens, and exposes the
// presets. This is what the Prompt Builder browses.

// A dynamic-prompt catalog key -> the token you'd type in a prompt.
function dpToken(key) {
  if (key.startsWith("v1/")) return `#${key.slice("v1/".length)}-v1`;
  if (key.startsWith("user-submitted/")) return `#user-${key.slice("user-submitted/".length)}`;
  return `#${key}`;
}

const byName = (a, b) => a.localeCompare(b);

export const catalog = {
  dynamicPrompts: browserLoader.dynamicPromptNames().map(dpToken).sort(byName),
  lists: browserLoader
    .listNames()
    .sort(byName)
    .map((n) => `{${n}}`),
  expansions: browserLoader
    .expansionNames()
    .sort(byName)
    .map((n) => `<${n}>`),
  presets: browserLoader.presetNames().sort(byName),
};

// A preset is a partial settings object that merges over the current settings.
export function loadPreset(name) {
  return browserLoader.loadPreset(name) || {};
}
