/**
 * @file
 * @brief JS sidecar for vibrant-art.dpl — space-joined colorful() helper.
 *        Invoked via `script: vibrant-art.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import _ from "lodash";

// "colorful" plus optional space-joined "multi-color" / "glow".
function colorful() {
  let out = "colorful";
  if (_.random(0.0, 1.0, false) < 0.5) out += " multi-color";
  if (_.random(0.0, 1.0, false) < 0.5) out += " glow";
  return out;
}

/**
 * Generate the vibrant-art scene (ported from v2 style/vibrant-art.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  return `${colorful()} {flower}, ${colorful()} {animal}, (black background), (black paper), (ink outlines), very detailed`;
}
