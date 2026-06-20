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
// Naming convention: plain `<name>` is SFW (ungated); `<name>-nsfw-only` is the
// NSFW-only list and `<name>-nsfw` is the group that imports both — both gated.
export const gatedLists = [
  "danbooru/danbooru-nsfw",
  "danbooru/d-keyword-nsfw",
  "danbooru/d/general-nsfw",
  "danbooru/d/general-nsfw-only",
  "artist/nudity",
  "keyword/keyword-adult",
  "look/clothes-adult",
  "word/adult",
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
