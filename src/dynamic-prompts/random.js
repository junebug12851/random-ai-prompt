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
 * @brief Full dynamic-prompt generator (#random): a complete, self-standing scene. See notes/reference/dynamic-prompts.md.
 */

import { keywordRepeater } from "../helpers/keywordRepeater.js";

/**
 * Generate the `#random` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function expandRandom(settings) {
  return keywordRepeater("keyword", true, settings);
}

export const full = true;
