/**
 * Shared engine access for the mobile app — the exact engine the web + CLI use, driven by the Metro
 * static catalog (no re-port). One instance for the whole app.
 */
import { createEngine } from "engine/core/engine.js";
import { metroLoader } from "engine/core/metroLoader.js";
import { createPromptRun } from "engine/promptRun.js";
import baseSettings from "engine/settings.js";

export const loader = metroLoader;
export const run = createPromptRun(createEngine(metroLoader));
export { baseSettings };

/** Word-list names for the gear's Vocabulary selects (mirrors the web getListNames()). */
export function getListNames() {
  try {
    return loader.listNames().slice().sort();
  } catch {
    return [];
  }
}

/**
 * Expand one DPL string to a concrete example (used by the live preview + the Insert menu examples).
 * No auto-FX / auto-artist noise, so the example reflects just the DPL — matching the web.
 * @param {string} dpl
 * @param {object} [extra] Extra settings overrides.
 * @returns {string}
 */
export function expandOnce(dpl, extra = {}) {
  try {
    const { prompts } = run.generatePrompts({
      ...baseSettings,
      autoAddFx: false,
      autoAddArtists: false,
      includeArtist: false,
      ...extra,
      prompt: dpl,
      promptCount: 1,
      randomSeed: true,
      generateImages: false,
    });
    return prompts[0] ?? "";
  } catch {
    return "";
  }
}
