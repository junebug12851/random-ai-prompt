/**
 * @file
 * @brief JS sidecar for artists.dpl — a random run of {artist} tokens via artistRepeater.
 */

import { artistRepeater } from "../../../src/helpers/keywordRepeater.js";

/**
 * Emit a random run of artist tokens.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  return artistRepeater("artist", true, settings);
}
