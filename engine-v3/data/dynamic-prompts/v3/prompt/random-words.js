/**
 * @file
 * @brief JS sidecar for random-words.dpl — a pile of random {keyword} tokens via keywordRepeater.
 */

import { keywordRepeater } from "../../../../src/helpers/keywordRepeater.js";

/**
 * Emit a random pile of keyword tokens.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  return keywordRepeater("keyword", true, settings);
}
