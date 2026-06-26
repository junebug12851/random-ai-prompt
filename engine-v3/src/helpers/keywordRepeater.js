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
 * @brief Emit N {keyword} / {artist} tokens for generators that want a variable count. Named exports on purpose (do not flip to default).
 */

import _ from "lodash";
import { keywordAlias, artistAlias } from "./aliases.js";

// Maps the `keyword`/`artist` repeat targets to their alias list name. Kept here
// (instead of indexing the fs-backed listFiles object) so this module stays
// browser-safe — see helpers/aliases.js.
const ALIASES = { keyword: keywordAlias, artist: artistAlias };

/**
 * Build a comma-joined run of `count` list tokens.
 * @param {number} count How many tokens to emit (<= 0 yields "").
 * @param {string} keyword The repeat target ("keyword" or "artist").
 * @param {boolean} alias Whether to resolve via the keyword/artist alias.
 * @returns {string} The joined `{token}, {token}, …` string.
 */
function processRepeat(count, keyword, alias) {
  if (count <= 0) return "";

  let str = [];

  for (let i = 0; i < count; i++) {
    if (alias == true) str.push(`{${ALIASES[keyword]}}`);
    else str.push(`{${keyword}}`);
  }

  return str.join(", ");
}

/**
 * Emit a random number of keyword tokens, between `settings.keywordCount` and
 * `settings.keywordMaxCount`.
 * @param {string} keyword The repeat target.
 * @param {boolean} alias Whether to resolve via the alias.
 * @param {object} settings The merged generation settings.
 * @returns {string} The joined keyword tokens.
 */
function keywordRepeater(keyword, alias, settings) {
  const keywordCount = _.random(settings.keywordCount, settings.keywordMaxCount, false);
  return processRepeat(keywordCount, keyword, alias);
}

/**
 * Emit a random number of artist tokens — gated by `settings.includeArtist` and a
 * 50% coin flip — between `settings.minArtist` and `settings.maxArtist`.
 * @param {string} artist The repeat target.
 * @param {boolean} alias Whether to resolve via the alias.
 * @param {object} settings The merged generation settings.
 * @returns {string} The joined artist tokens (possibly "").
 */
function artistRepeater(artist, alias, settings) {
  const artistCount =
    settings.includeArtist && _.random(0.0, 1.0, true) < 0.5
      ? _.random(settings.minArtist, settings.maxArtist, false)
      : 0;

  return processRepeat(artistCount, artist, alias);
}

export { keywordRepeater, artistRepeater };
