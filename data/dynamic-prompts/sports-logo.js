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
 * @brief Full dynamic-prompt generator (#sports-logo): a complete, self-standing scene. See notes/reference/dynamic-prompts.md.
 */

// This was taken from publicprompts.art and modified to be more dynamic

import _ from "lodash";

// 2d ferocious <name>, vector illustration, angry eyes, football team emblem logo, 2d flat, centered
/**
 * Generate the `#sports-logo` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  // This will not work well with added artists or fx
  settings.autoAddArtists = false;
  settings.autoAddFx = false;

  // Start with base prompt
  return `2d ferocious #living-entity vector illustration, angry eyes, football team emblem logo, 2d flat, centered`;
}

export const full = true;
