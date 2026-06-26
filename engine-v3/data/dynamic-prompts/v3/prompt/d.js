/**
 * @file
 * @brief JS sidecar for d.dpl — danbooru anime tag stream ({d/general} + {d/character} + {d/meta}).
 */

import _ from "lodash";
import { keywordRepeater } from "../../../../src/helpers/keywordRepeater.js";

/**
 * Build a danbooru tag stream.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  const metaCount = _.random(0, 2, false);
  const characterCount = _.random(0, 2, false);

  const str = [];
  str.push(keywordRepeater("d/general-nsfw", false, settings));

  if (_.random(0.0, 1.0, true) < 0.2)
    for (let i = 0; i < characterCount; i++) str.push(`{d/character}`);
  for (let i = 0; i < metaCount; i++) str.push(`{d/meta}`);

  return str.join(", ");
}
