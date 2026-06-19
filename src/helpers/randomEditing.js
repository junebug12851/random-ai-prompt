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
 * @brief Keyword randomizer (StableDiffusion only): prompt-editing forms edit-in / swap / edit-out.
 */

import _ from "lodash";

/**
 * Prompt-editing "edit-in": `[kw:n]` — kw appears after step n.
 * @param {object} settings The merged generation settings (`keywordEditingMin/Max`).
 * @param {string} keyword The keyword.
 * @returns {string} The edit-in form.
 */
function editIn(settings, keyword) {
  return `[${keyword}:${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

/**
 * Prompt-editing "swap": `[kw:kw:n]` — re-assert the keyword at step n.
 * @param {object} settings The merged generation settings (`keywordEditingMin/Max`).
 * @param {string} keyword The keyword.
 * @returns {string} The swap form.
 */
function swapOut(settings, keyword) {
  return `[${keyword}:${keyword}:${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

/**
 * Prompt-editing "edit-out": `[kw::n]` — kw drops at step n.
 * @param {object} settings The merged generation settings (`keywordEditingMin/Max`).
 * @param {string} keyword The keyword.
 * @returns {string} The edit-out form.
 */
function editOut(settings, keyword) {
  return `[${keyword}::${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

/**
 * Randomly apply one StableDiffusion prompt-editing form (edit-in / swap / edit-out).
 * No-op unless `keywordEditing` is on and mode is StableDiffusion.
 * @param {object} settings The merged generation settings.
 * @param {string} keyword The keyword.
 * @returns {{keyword: string, wasUsed: boolean}} The (possibly) edited keyword and whether it changed.
 */
// Adds random editing to keywords
export default function randomEditing(settings, keyword) {
  // Stop here if editing is disabled or this isn't StableDiffusion
  // To my knowledge, only stable diffusion allows prompt editing
  if (!settings.keywordEditing || settings.mode != "StableDiffusion") {
    return { keyword, wasUsed: false };
  }

  // Figure out what kind of editing
  switch (_.random(0, 2, false)) {
    case 0:
      keyword = editIn(settings, keyword);
      break;
    case 1:
      keyword = swapOut(settings, keyword);
      break;
    case 2:
      keyword = editOut(settings, keyword);
      break;
  }

  // Send prompt back
  return { keyword, wasUsed: true };
}
