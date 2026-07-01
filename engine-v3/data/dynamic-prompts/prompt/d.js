/**
 * @file
 * @brief JS sidecar for d.dpl — danbooru anime tag stream ({d/general} + {d/character} + {d/meta}).
 */

import { randomInt, randomFloat } from "../../../src/helpers/random.js";
import { keywordRepeater } from "../../../src/helpers/keywordRepeater.js";

/**
 * Build a danbooru tag stream.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  const metaCount = randomInt(0, 2);
  const characterCount = randomInt(0, 2);

  const str = [];
  str.push(keywordRepeater("d/general-nsfw", false, settings));

  if (randomFloat() < 0.2) for (let i = 0; i < characterCount; i++) str.push(`{d/character}`);
  for (let i = 0; i < metaCount; i++) str.push(`{d/meta}`);

  return str.join(", ");
}
