/**
 * @file
 * @brief JS sidecar for random.dpl — a full random suggestion (AND-weighted blends) via promptSuggestion.
 */

import suggestion from "../../../src/promptFilesAndSuggestions.js";

/**
 * Build a full random prompt suggestion.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  suggestion.init(function () {
    return { settings };
  });
  suggestion.loadAll();
  const prompt = suggestion.promptSuggestion(true);
  settings.randomPrompt = prompt;
  return prompt;
}
