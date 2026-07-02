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
 * @brief Adult/NSFW gating behind the `includeAdult` setting (default off). Gating
 * is AUTOMATIC by name: any list/group whose name carries an `nsfw` token (a word
 * delimited by `/`, `-`, `.`, `_`, or the start/end of the string) is gated. When
 * adult is off such names are excluded from suggestions, hidden from the picker, and
 * resolve to "" if referenced directly. Pure data — no Node imports, browser-safe.
 */

/**
 * Matches an `nsfw` token: a standalone word in a list name, delimited by a path
 * separator, dash, dot, underscore, or the start/end of the string. So
 * `d/general-nsfw`, `clothes-nsfw`, `foo.nsfw.bar` all match, but `nsfwish` does not.
 * @type {RegExp}
 */
export const NSFW_TOKEN = /(^|[/._-])nsfw([/._-]|$)/i;

/**
 * @param {string} name A list/group name.
 * @returns {boolean} Whether the name carries an `nsfw` token.
 */
export function hasNsfwToken(name) {
  return NSFW_TOKEN.test(String(name));
}

// Extra dynamic prompts to gate by exact name, on top of the automatic `nsfw`-token
// rule below. Empty today (#danbooru pulls the mode-aware d/general, SFW when adult is
// off), but kept as an escape hatch for a generator that is adult without an nsfw token.
export const gatedDynPrompts = [];

/**
 * @param {string} name A list/group name.
 * @returns {boolean} Whether the list is gated behind `includeAdult` (by nsfw token).
 */
export function isGatedList(name) {
  return hasNsfwToken(name);
}

/**
 * Gate a dynamic prompt behind `includeAdult` AUTOMATICALLY by its name token — the same
 * rule lists/expansions use (`isGatedList`) — so a generator named e.g.
 * `subject/nude-nsfw` is hidden/empty when adult is off, with no hardcoded list to keep
 * in sync. The legacy `gatedDynPrompts` array is still honored as an extra escape hatch.
 * @param {string} name A dynamic-prompt name (path or token).
 * @returns {boolean} Whether the dynamic prompt is gated behind `includeAdult`.
 */
export function isGatedDynPrompt(name) {
  return hasNsfwToken(name) || gatedDynPrompts.includes(name);
}
