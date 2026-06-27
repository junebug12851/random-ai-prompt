/**
 * @file
 * @brief JS sidecar for spaceship.dpl — adjectives are space-joined onto "spaceship".
 *        Invoked via `script: spaceship.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import _ from "lodash";

/**
 * Generate the spaceship fragment (ported from v2 scene/spaceship.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  let prompt = "";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += " {#neon}";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += " {#neon}";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += " {size}";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += " {style/construct}";

  prompt += " spaceship";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", spacecraft";

  return prompt.trim();
}
