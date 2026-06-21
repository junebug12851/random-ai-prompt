/**
 * @file
 * @brief JS sidecar for extra-random.dpl — forces any-list mode then runs the full random suggestion.
 */

import randomPrompt from "./random.js";

/**
 * Build a maximum-chaos random prompt (any keyword/artist list).
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  settings.keywordsFilename = false;
  settings.artistFilename = false;
  return randomPrompt(settings);
}
