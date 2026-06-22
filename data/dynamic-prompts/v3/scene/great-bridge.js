/**
 * @file
 * @brief JS sidecar for great-bridge.dpl — size() helper + inline interpolation.
 *        Invoked via `script: great-bridge.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import _ from "lodash";

// A space-joined size phrase (giant/huge/massive + optional epic/expansive).
function size() {
  let prompt = "";
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
  return prompt;
}

/**
 * Generate the great-bridge scene (ported from v2 scene/great-bridge.js).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  let prompt = `a beautiful${size()} bridge over a${size()} ocean with many clouds beneath bridge, wide angle, closeup`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", exotic";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", fog";
  if (_.random(0.0, 1.0, true) < 0.25) prompt += ", hill";
  if (_.random(0.0, 1.0, true) < 0.25) prompt += ", winter, snow landscape, {#ice}";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", {#eerie}";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {#mystical}";

  prompt += ", {#weather}";
  return prompt;
}
