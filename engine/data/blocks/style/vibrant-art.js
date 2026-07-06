/**
 * @file
 * @brief JS sidecar for vibrant-art.dpl — space-joined colorful() helper.
 *        Invoked via `script: vibrant-art.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import { randomFloat } from "../../../helpers/random.js";

// "colorful" plus optional space-joined "multi-color" / "glow" (each a 50% coin flip).
function colorful() {
  let out = "colorful";
  if (randomFloat() < 0.5) out += " multi-color";
  if (randomFloat() < 0.5) out += " glow";
  return out;
}

/**
 * Generate the vibrant-art scene (ported from v2 style/vibrant-art.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  return `${colorful()} {flower}, ${colorful()} {animal}, (black background), (black paper), (ink outlines)`;
}
