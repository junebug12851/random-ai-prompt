/*
    Copyright 2026 junebug12851

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
 * @brief Content-safety filter for the prompt lists. Pure data + matchers, no
 * Node-only imports (safe in the browser, like gatedLists.js).
 *
 * This is a profanity/abuse FILTER definition: the terms exist so the project
 * can DETECT and REMOVE them — never to surface them. Consumed by the CSV build
 * scripts (so regeneration stays clean) and the one-time cleanup tooling under
 * scripts/list-cleanup/. The NSFW lexicon additionally drives the SFW/NSFW
 * split + virtual lists.
 *
 * Policy (decided with the project owner, 2026-06-20):
 *   REMOVE entirely   -> genuine slurs, content sexualizing minors, and extreme
 *                        shock/gore/non-consensual material.
 *   KEEP but NSFW-gate -> ordinary nudity/adult terms (tagged via isNsfw(),
 *                        NOT deleted).
 *
 * Matching is WHOLE-WORD / WHOLE-PHRASE on a normalized, space-separated form,
 * so "cockpit" never matches "cock". `listType` applies the unambiguous slur
 * set everywhere while reserving the ambiguous + sexual + gore sets for content
 * lists; on proper-noun lists matching is EXACT (whole entry) so "Coon Rapids"
 * and "Rio Negro" survive while a bare "coon" entry does not.
 */

/* eslint-disable no-useless-escape */

import {
  SLURS_CORE,
  SLURS_AMBIGUOUS,
  MINOR_SEXUAL,
  EXTREME,
  WHITELIST,
  NSFW_LEXICON,
} from "./safetyLexicons.js";

/**
 * Normalize a raw list line to a lowercase, single-spaced token string.
 * @param {string} line Raw line.
 * @returns {string} Normalized form, e.g. "long hair".
 */
export function normalize(line) {
  return line
    .toLowerCase()
    .replace(/[_\/\\\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMatcher(terms) {
  const words = new Set();
  const phrases = [];
  for (const t of terms) {
    const n = normalize(t);
    if (!n) continue;
    if (n.includes(" ")) phrases.push(n);
    else words.add(n);
  }
  return { words, phrases };
}

const M_SLUR_CORE = buildMatcher(SLURS_CORE);
const M_SLUR_AMB = buildMatcher(SLURS_AMBIGUOUS);
const M_MINOR = buildMatcher(MINOR_SEXUAL);
const M_EXTREME = buildMatcher(EXTREME);
const M_NSFW = buildMatcher(NSFW_LEXICON);

function hit(matcher, norm, tokenSet, mode) {
  if (mode === "exact") {
    if (matcher.words.has(norm)) return norm;
    for (const p of matcher.phrases) if (norm === p) return p;
    return null;
  }
  for (const w of matcher.words) if (tokenSet.has(w)) return w;
  for (const p of matcher.phrases) {
    if (
      norm === p ||
      norm.includes(` ${p} `) ||
      norm.startsWith(`${p} `) ||
      norm.endsWith(` ${p}`)
    ) {
      return p;
    }
  }
  return null;
}

/**
 * Classify a single list line for removal.
 * @param {string} line Raw line.
 * @param {object} [opts]
 * @param {("proper"|"content")} [opts.listType="content"] Proper lists (cities,
 *   names, artists, parts of speech) get core slurs + minor-sexual matched
 *   EXACTLY (whole entry); content lists get the full set with token matching.
 * @returns {{category: string, term: string}|null} Category + matched term, or
 *   null when clean.
 */
export function classifyRemoval(line, opts = {}) {
  const listType = opts.listType || "content";
  const mode = listType === "content" ? "token" : "exact";
  const norm = normalize(line);
  if (!norm) return null;
  if (WHITELIST.has(norm)) return null;
  const tokens = new Set(norm.split(" "));

  let m = hit(M_SLUR_CORE, norm, tokens, mode);
  if (m) return { category: "slur", term: m };

  m = hit(M_MINOR, norm, tokens, mode);
  if (m) return { category: "minor-sexual", term: m };

  if (listType === "content") {
    m = hit(M_SLUR_AMB, norm, tokens, mode);
    if (m) return { category: "slur-ambiguous", term: m };

    m = hit(M_EXTREME, norm, tokens, mode);
    if (m) return { category: "extreme", term: m };
  }

  return null;
}

/**
 * @param {string} line Raw line.
 * @returns {boolean} True if the line reads as ordinary NSFW (adult/nudity).
 *   Used for the SFW/NSFW split, NOT for removal.
 */
export function isNsfw(line) {
  const norm = normalize(line);
  if (!norm) return false;
  const tokens = new Set(norm.split(" "));
  return hit(M_NSFW, norm, tokens, "token") != null;
}

export const _sets = {
  SLURS_CORE,
  SLURS_AMBIGUOUS,
  MINOR_SEXUAL,
  EXTREME,
  NSFW_LEXICON,
  WHITELIST,
};
