/**
 * @file
 * @brief JS sidecar for great-tree.dpl — size + tree-type word-building with inline interpolation.
 *        Invoked via `script: great-tree.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import _ from "lodash";

/**
 * Generate the great-tree scene (ported from v2 scene/great-tree.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  let prompt = "((a beautiful";

  switch (_.random(0, 2, false)) {
    case 0:
      prompt += " giant";
      break;
    case 1:
      prompt += " huge";
      break;
    case 2:
      prompt += " massive";
      break;
  }

  if (_.random(0.0, 1.0, true) < 0.5) prompt += " epic";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += " expansive";

  switch (_.random(0, 2, false)) {
    case 0:
      prompt += " willow tree";
      break;
    case 1:
      prompt += " tree of life";
      break;
    case 2:
      prompt += " tree";
      break;
  }

  prompt += " growing in the middle of an ancient forest)), wide angle, closeup";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", exotic";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", fog";
  if (_.random(0.0, 1.0, true) < 0.25) prompt += ", hill";
  if (_.random(0.0, 1.0, true) < 0.25) prompt += ", winter, snow landscape, {#ice}";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", {#eerie}";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {#mystical}";
  if (_.random(0.0, 1.0, true) < 0.2) prompt += ", water";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", bioluminescent";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", {#glow}";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", {#glow}";

  prompt += ", {#nature}, {#weather}";
  return prompt;
}
