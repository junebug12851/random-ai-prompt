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
 * @brief List and dynamic-prompt names gated behind the `includeAdult` setting
 * (default off). When off, these are excluded from random suggestions and resolve
 * to "" if referenced directly. Pure data — no Node-only imports, safe in browser.
 */

// List files that are only drawn from when `includeAdult` is enabled.
export const gatedLists = [
  "danbooru",
  "danbooru/d/general",
  "d-keyword",
  "artist/nudity",
  "keyword/keyword-adult",
];

// Dynamic prompts that are only suggested when `includeAdult` is enabled.
export const gatedDynPrompts = ["danbooru"];

/**
 * @param {string} name A list name.
 * @returns {boolean} Whether the list is gated behind `includeAdult`.
 */
export function isGatedList(name) {
  return gatedLists.includes(name);
}

/**
 * @param {string} name A dynamic-prompt name.
 * @returns {boolean} Whether the dynamic prompt is gated behind `includeAdult`.
 */
export function isGatedDynPrompt(name) {
  return gatedDynPrompts.includes(name);
}
