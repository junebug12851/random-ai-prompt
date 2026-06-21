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
 * @brief Full dynamic-prompt generator (#fluffy-animal): a complete, self-standing scene. See notes/reference/dynamic-prompts.md.
 */

// This was taken from publicprompts.art and modified to be more dynamic

// 3d fluffy <name>, closeup cute and adorable, cute big circular reflective eyes, long fuzzy fur, Pixar render, unreal engine cinematic smooth, intricate detail, cinematic
/**
 * Generate the `#fluffy-animal` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  // This will not work well with added artists or fx
  settings.autoAddArtists = false;
  settings.autoAddFx = false;

  // Start with base prompt
  return `3d fluffy, #animal closeup cute and adorable, cute big circular reflective eyes, long fuzzy fur, Pixar render, unreal engine cinematic smooth, intricate detail, cinematic`;
}

export const full = true;
