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
 * @brief Legacy v1 dynamic-prompt generator (#comic-v1): a frozen, monolithic version of the scene, kept for reproducibility. See notes/reference/dynamic-prompts.md.
 */

// This was taken from publicprompts.art and modified to be more dynamic

import entityBasicKeywords from "../v2/subject/entity.js";

// Retro comic style artwork, highly detailed <name>, comic book cover, symmetrical, vibrant
/**
 * Generate the `#comic-v1` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @param {object} imageSettings The imageSettings.
 * @param {object} upscaleSettings The upscaleSettings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  // Start with base prompt
  let prompt = `Retro comic style artwork, highly detailed `;
  prompt += entityBasicKeywords();
  prompt += `, comic book cover, symmetrical, vibrant`;

  return prompt;
}
