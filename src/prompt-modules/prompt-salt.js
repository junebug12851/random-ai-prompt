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
 * @brief Pipeline stage: inject the {salt} / [n] seed-salt (random or incrementing). Notes: notes/reference/prompt-dsl.md.
 */

import { randomInt } from "../helpers/random.js";

/**
 * @returns {string} A fresh random salt token like `[1234567890]`.
 */
function getRndSalt() {
  return `[${randomInt(1000000000, 9999999999)}]`;
}

/**
 * Prompt-salt pipeline stage: resolve `{salt}` / `[n]` tokens (and optionally
 * auto-append a salt) to a random or incrementing seed-salt number; records the
 * bare number in `imageSettings.usedSalt`.
 * @param {string} prompt The incoming prompt.
 * @param {object} settings The merged generation settings (`promptSalt`, `promptSaltStart`).
 * @param {object} imageSettings Image settings; receives `usedSalt`.
 * @param {object} [upscaleSettings] Unused.
 * @returns {string} The prompt with salt resolved/appended.
 */
export default function promptSalt(prompt, settings, imageSettings, _upscaleSettings) {
  let foundSalt = false;
  let val = settings.promptSaltStart;

  prompt = prompt.replaceAll(/\{salt\}/gm, function () {
    foundSalt = true;
    imageSettings.usedSalt = val >= 0 ? `[${val}]` : getRndSalt();
    return val >= 0 ? `[${val}]` : getRndSalt();
  });

  prompt = prompt.replaceAll(/\[\d+\]/gm, function () {
    foundSalt = true;
    imageSettings.usedSalt = val >= 0 ? `[${val}]` : getRndSalt();
    return val >= 0 ? `[${val}]` : getRndSalt();
  });

  if (settings.promptSalt && !foundSalt) {
    imageSettings.usedSalt = val >= 0 ? `[${val}]` : getRndSalt();

    if (val >= 0) prompt = `${prompt} [${val}]`;
    else prompt = `${prompt} ${getRndSalt()}`;
  }

  // Remove brackets around used salt
  if (imageSettings.usedSalt != undefined)
    imageSettings.usedSalt = imageSettings.usedSalt.replaceAll(/[[\]]/gm, "");

  if (val >= 0) {
    settings.promptSaltStart++;
  }

  // Return prompt
  return prompt;
}
