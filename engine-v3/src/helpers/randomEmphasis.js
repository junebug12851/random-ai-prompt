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
 * @brief Keyword randomizer: per-engine emphasis / de-emphasis (SD parens-brackets, NAI braces, Midjourney ::factor). Notes: notes/reference/prompt-dsl.md.
 */

import { randomFloat } from "./random.js";

/**
 * StableDiffusion emphasis: wrap the keyword in N nested `()` (emphasis) or `[]`
 * (de-emphasis); N is rolled by `emphasisLevelChance` up to `emphasisMaxLevels`.
 * @param {object} settings The merged generation settings.
 * @param {boolean} lessEmphasis De-emphasize (`[]`) rather than emphasize (`()`).
 * @param {string} keyword The keyword to wrap.
 * @returns {string} The wrapped keyword.
 */
function processSd(settings, lessEmphasis, keyword) {
  // Prepare for emphasis/de-emphasis leveling
  let prefix = "";
  let suffix = "";
  let count = 0;

  // Randomly add emphasis/de-emphasis levels based on chance for each level up to set max
  do {
    prefix += lessEmphasis ? "[" : "(";
    suffix += lessEmphasis ? "]" : ")";
    count++;
  } while (randomFloat() < settings.emphasisLevelChance && count < settings.emphasisMaxLevels);

  // Update modified keyword with emphais/de-emphasis
  keyword = `${prefix}${keyword}${suffix}`;

  return keyword;
}

/**
 * NovelAI emphasis: same nested-bracket leveling as SD (the list stage later
 * rewrites `()` to `{}` for NovelAI).
 * @param {object} settings The merged generation settings.
 * @param {boolean} lessEmphasis De-emphasize rather than emphasize.
 * @param {string} keyword The keyword to wrap.
 * @returns {string} The wrapped keyword.
 */
function processNAI(settings, lessEmphasis, keyword) {
  // NAI uses the same nested-bracket leveling as SD; the list stage rewrites `()` to `{}` for
  // NovelAI afterwards, so the emphasis pass itself is identical — delegate rather than duplicate.
  return processSd(settings, lessEmphasis, keyword);
}

/**
 * Midjourney emphasis: append `::factor`, factor = 1.05·N up (or its reciprocal
 * down); N is rolled by `emphasisLevelChance` up to `emphasisMaxLevels`.
 * @param {object} settings The merged generation settings.
 * @param {boolean} lessEmphasis De-emphasize rather than emphasize.
 * @param {string} keyword The keyword to weight.
 * @returns {string} The weighted keyword.
 */
function processMdj(settings, lessEmphasis, keyword) {
  // Prepare for emphasis/de-emphasis leveling
  let count = 0;

  // Randomly add emphasis/de-emphasis levels based on chance for each level up to set max
  do {
    count++;
  } while (randomFloat() < settings.emphasisLevelChance && count < settings.emphasisMaxLevels);

  // Base factor
  let factor = 1;

  if (lessEmphasis && count > 0) factor /= 1.05 * count;
  else if (!lessEmphasis && count > 0) factor *= 1.05 * count;

  factor = Number.parseFloat(factor.toFixed(2));

  // Update modified keyword with emphais/de-emphasis
  if (count > 0) keyword = `${keyword}::${factor}`;

  return keyword;
}

// Default natural-language ladders for the `Plain` dialect. The roll picks a level
// (count) exactly like the other dialects; instead of syntax, the level selects an
// intensifier (more) or a hedge (less) word that prefixes the keyword — so a service
// with no weighting grammar still receives the emphasis the engine rolled, expressed
// in words. Override per provider via `settings.plainEmphasisWords` /
// `settings.plainDeEmphasisWords` (e.g. a provider's data/ wordbank).
const PLAIN_MORE = ["prominent", "strongly emphasized", "dominant"];
const PLAIN_LESS = ["subtle", "faint", "barely-there"];

/**
 * Plain (natural-language) emphasis: roll a level like the other dialects, then prefix
 * the keyword with an intensifier (emphasis) or hedge (de-emphasis) word from the ladder
 * — keeping the emphasis the engine rolled instead of dropping it for syntax-less targets.
 * @param {object} settings The merged generation settings.
 * @param {boolean} lessEmphasis De-emphasize (hedge) rather than emphasize (intensify).
 * @param {string} keyword The keyword to modify.
 * @returns {string} The (possibly) word-prefixed keyword.
 */
function processPlain(settings, lessEmphasis, keyword) {
  // Roll the level the same way the syntax dialects do (count of "nesting").
  let count = 0;
  do {
    count++;
  } while (randomFloat() < settings.emphasisLevelChance && count < settings.emphasisMaxLevels);

  const ladder = lessEmphasis
    ? settings.plainDeEmphasisWords || PLAIN_LESS
    : settings.plainEmphasisWords || PLAIN_MORE;

  if (count > 0 && ladder.length) {
    // Cap the level at the ladder's length; deeper rolls just use the strongest word.
    const word = ladder[Math.min(count, ladder.length) - 1];
    if (word) keyword = `${word} ${keyword}`;
  }

  return keyword;
}

/**
 * Randomly emphasize or de-emphasize a keyword for the active dialect (SD / NAI / MDJ / Plain).
 * @param {object} settings The merged generation settings.
 * @param {string} keyword The keyword to modify.
 * @returns {{keyword: string, wasUsed: boolean}} The (possibly) modified keyword and whether it changed.
 */
// Adds random emphasis/de-emphasis to keywords
export default function randomEmphasis(settings, keyword) {
  // Stop here if emphasis is disabled
  if (!settings.keywordEmphasis) {
    return { keyword, wasUsed: false };
  }

  // Roll to see if this keword gets less emphasis
  let lessEmphasis = randomFloat() < settings.deEmphasisChance;

  // Process according to mode
  if (settings.mode == "StableDiffusion") keyword = processSd(settings, lessEmphasis, keyword);
  else if (settings.mode == "NovelAI") keyword = processNAI(settings, lessEmphasis, keyword);
  else if (settings.mode == "Midjourney") keyword = processMdj(settings, lessEmphasis, keyword);
  else if (settings.mode == "Plain") keyword = processPlain(settings, lessEmphasis, keyword);

  // Send prompt back
  return { keyword, wasUsed: true };
}
