/*
    Copyright 2022 juenbug12851

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/**
 * @file
 * @brief Full dynamic-prompt generator (#great-bridge): a complete, self-standing scene. See notes/reference/dynamic-prompts.md.
 */

import _ from "lodash";

function size() {
  // Start with base prompt
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
 * Generate the `#great-bridge` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  // Start with base prompt
  let prompt = `a beautiful ${size()} bridge over a ${size()} ocean with many clouds beneath bridge, intricate detail, highly detailed, wide angle, closeup`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", exotic";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", fog";

  if (_.random(0.0, 1.0, true) < 0.25) prompt += ", hill";

  if (_.random(0.0, 1.0, true) < 0.25) prompt += `, winter, snow landscape, {#ice}`;

  if (_.random(0.0, 1.0, true) < 0.35) prompt += `, {#eerie}`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, {#mystical}`;

  prompt += `, {#weather}, <dap>`;

  return prompt;
}

export const full = true;
