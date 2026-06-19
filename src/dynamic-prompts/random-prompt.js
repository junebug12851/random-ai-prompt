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
 * @brief Full dynamic-prompt generator (#random-prompt): a complete, self-standing scene. See notes/reference/dynamic-prompts.md.
 */

import suggestion from "../promptFilesAndSuggestions.js";

/**
 * Generate the `#random-prompt` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  // Init
  suggestion.init(function () {
    return { settings };
  });

  // Load All
  suggestion.loadAll();

  // Execute a full suggestion
  const prompt = suggestion.promptSuggestion(true);

  // Save into settings
  settings.randomPrompt = prompt;

  // Return
  return prompt;
}

export const full = true;
export const suggestion_exclude = true;
