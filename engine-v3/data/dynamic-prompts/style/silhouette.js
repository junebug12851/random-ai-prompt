/**
 * @file
 * @brief JS sidecar for silhouette.dpl — "at <time> with <weather>" sentence interpolation.
 *        Invoked via `script: silhouette.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import { randomFloat } from "../../../src/helpers/random.js";

/**
 * Generate the silhouette scene (ported from v2 style/silhouette.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  let prompt =
    "Multiple layers of silhouette {#entity-name}, with silhouette of {#entity-name}, sharp edges, at";

  if (randomFloat() < 0.5) prompt += " {time}";
  else prompt += " sunset";

  prompt += " with";

  if (randomFloat() < 0.5) prompt += " {weather}";
  else prompt += " heavy fog in air";

  prompt +=
    ", vector style, horizon silhouette Landscape wallpaper by Alena Aenami, firewatch game style, vector style background";

  return prompt;
}
