/**
 * @file
 * @brief JS sidecar for simple-random.dpl — a single full random suggestion via promptSuggestion.
 */

import suggestion from "../../../promptFilesAndSuggestions.js";

/**
 * Build a single (lighter) random prompt suggestion.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  suggestion.init(function () {
    return { settings };
  });
  suggestion.loadAll();
  const prompt = suggestion.promptSuggestion();
  settings.randomPrompt = prompt;
  return prompt;
}
