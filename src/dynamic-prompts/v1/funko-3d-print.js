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
 * @brief Legacy v1 dynamic-prompt generator (#funko-3d-print-v1): a frozen, monolithic version of the scene, kept for reproducibility. See notes/reference/dynamic-prompts.md.
 */

// This was taken from publicprompts.art and modified to be more dynamic

import _ from "lodash";

import entityBasicKeywords from "../entity.js";

function maybeAddColor() {
  if (_.random(0.0, 1.0, true) < 0.5) return "{color} ";
  else return "";
}

// Funko pop <name> figurine, made of plastic, product studio shot, on a white background, diffused lighting, centered
/**
 * Generate the `#funko-3d-print-v1` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @param {object} imageSettings The imageSettings.
 * @param {object} upscaleSettings The upscaleSettings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  // Start with base prompt
  let prompt = `Funko pop`;

  switch (_.random(0, 1, false)) {
    case 0:
      prompt += ` {d-character}`;
      break;
    case 1:
      prompt += ` person`;
      break;
  }

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, ${maybeAddColor()}{hair}`;

  const clothingCount = _.random(0.0, 1.0, true) < 0.5 ? _.random(0, 5, false) : 0;

  for (let i = 0; i < clothingCount; i++) {
    prompt += `, ${maybeAddColor()}{clothes}`;
  }

  prompt +=
    " figurine, made of plastic, product studio shot, on a white background, diffused lighting, centered";

  return prompt;
}
