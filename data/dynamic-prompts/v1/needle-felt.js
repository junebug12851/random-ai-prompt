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
 * @brief Legacy v1 dynamic-prompt generator (#needle-felt-v1): a frozen, monolithic version of the scene, kept for reproducibility. See notes/reference/dynamic-prompts.md.
 */

// This was taken from publicprompts.art and modified to be more dynamic

import _ from "lodash";
import entityBasicKeywords from "../entity.js";

function maybeAddColor() {
  if (_.random(0.0, 1.0, true) < 0.5) return "{color} ";
  else return "";
}

// tiny cute 3D felt fiber <name>, made from Felt fibers, a 3D render, trending on cgsociety, rendered in maya, rendered in cinema4d, made of yarn, square image

/**
 * Generate the `#needle-felt-v1` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @param {object} imageSettings The imageSettings.
 * @param {object} upscaleSettings The upscaleSettings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  // Start with base prompt
  let prompt = `tiny cute 3D felt fiber `;
  prompt += entityBasicKeywords();
  prompt += ` made from Felt fibers, a 3D render, trending on cgsociety, rendered in maya, rendered in cinema4d, made of yarn, square image`;

  return prompt;
}
