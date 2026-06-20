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
 * @brief List metadata + virtual (composite) lists. Pure data + a tiny resolver,
 * no Node-only imports (browser-safe, like gatedLists.js / contentSafety.js).
 *
 * A VIRTUAL list is one defined as a union of other lists (physical or virtual)
 * rather than a file on disk. This is how the project "collapses lists into
 * others": the big duplicated files the build scripts used to emit (danbooru,
 * d-keyword, d-character, artist, artist-digipa) are now computed on demand from
 * their atomic parts, with cross-member de-duplication. A virtual list may also
 * carry a `filter` ("sfw"/"nsfw") applied via the contentSafety NSFW lexicon —
 * that is how `danbooru-sfw` is produced without a second hand-maintained file.
 *
 * `listTags` records per-list metadata (category + anime/nsfw flags) for the UI
 * and for documentation; it does not gate anything by itself (gating stays in
 * gatedLists.js).
 */

import { isNsfw } from "./contentSafety.js";

/**
 * Per-list metadata. Any list not listed here defaults to
 * { anime:false, nsfw:false }. `nsfw:true` means the list as a whole leans
 * adult (still drawn only when includeAdult is on if it is also gated).
 * @type {Object<string,{category?:string,anime?:boolean,nsfw?:boolean}>}
 */
export const listTags = {
  // danbooru / anime content (files live under danbooru/d/, short ref "d/<name>")
  danbooru: { category: "danbooru", anime: true, nsfw: true },
  "danbooru-sfw": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/general": { category: "danbooru", anime: true, nsfw: true },
  "danbooru/d/artist": { category: "danbooru", anime: true, nsfw: false },
  "d-character": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-c": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-nc": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/meta": { category: "danbooru", anime: true, nsfw: false },
  "d-keyword": { category: "danbooru", anime: true, nsfw: true },
  "danbooru/d/person": { category: "danbooru", anime: true, nsfw: false },
  "keyword/keyword-adult": { category: "keyword", anime: false, nsfw: true },
  "artist/anime": { category: "artist", anime: true, nsfw: false },
  "name/anime-name": { category: "subject", anime: true, nsfw: false },
  "artist/nudity": { category: "artist", anime: false, nsfw: true },

  // dictionary-derived part-of-speech lists (general English, sfw)
  "word/dict-adjective": { category: "pos", anime: false, nsfw: false },
  "word/dict-noun": { category: "pos", anime: false, nsfw: false },
  "word/dict-verb": { category: "pos", anime: false, nsfw: false },
  "word/dict-adverb": { category: "pos", anime: false, nsfw: false },
  "word/dict-misc": { category: "pos", anime: false, nsfw: false },

  // proper-noun categories (hand-classified from the old keyword.txt dump)
  "name/demonym": { category: "subject", anime: false, nsfw: false },
  "name/given-name": { category: "name", anime: false, nsfw: false },
  "name/person": { category: "name", anime: false, nsfw: false },
  "place/place": { category: "place", anime: false, nsfw: false },
  "brand/organization": { category: "brand", anime: false, nsfw: false },
  "lore/mythology": { category: "subject", anime: false, nsfw: false },
  "lore/astronomy": { category: "subject", anime: false, nsfw: false },
  "lore/people-group": { category: "subject", anime: false, nsfw: false },
  "lore/religion": { category: "subject", anime: false, nsfw: false },
  "lore/history": { category: "subject", anime: false, nsfw: false },
  "lore/work": { category: "subject", anime: false, nsfw: false },
};

/**
 * Virtual (composite) lists, computed from other lists.
 * `union` lists the member lists (de-duplicated, in order). `filter` optionally
 * keeps only sfw or only nsfw lines.
 * @type {Object<string,{union:string[],filter?:("sfw"|"nsfw")}>}
 */
export const virtualLists = {
  // --- collapsed danbooru composites (members live under danbooru/d/) ---
  "d-character": { union: ["danbooru/d/character-nc", "danbooru/d/character-c"] },
  "d-keyword": {
    union: ["danbooru/d/general", "danbooru/d/character-c", "danbooru/d/character-nc", "danbooru/d/meta"],
  },
  danbooru: {
    union: [
      "danbooru/d/general", "danbooru/d/artist", "danbooru/d/character-c",
      "danbooru/d/character-nc", "danbooru/d/meta",
    ],
  },
  // SFW view of danbooru — the clean anime list, no second file to maintain
  "danbooru-sfw": { union: ["danbooru"], filter: "sfw" },

  // --- collapsed artist composites ---
  "artist-digipa": { union: ["artist/dhigh", "artist/dmed", "artist/dlow"] },
  artist: {
    union: [
      "artist/anime", "artist/bw", "artist/cartoon", "artist/dhigh",
      "artist/dmed", "artist/dlow", "artist/fareast", "artist/fineart",
      "artist/nudity", "artist/scribbles", "artist/special", "artist/ukioe",
      "artist/weird",
    ],
  },

  // --- curated + dictionary, combined (quality default stays separate) ---
  // any human name (first names + notable people)
  name: { union: ["name/given-name", "name/person"] },

  "adjective-all": { union: ["word/adjective", "word/dict-adjective", "name/demonym"] },
  "noun-all": { union: ["word/noun", "word/dict-noun", "name/demonym"] },
  "verb-all": { union: ["word/verb", "word/dict-verb"] },
  "adverb-all": { union: ["word/adverb", "word/dict-adverb"] },
};

/**
 * @param {string} name A list name.
 * @returns {boolean} Whether the name is a virtual (composite) list.
 */
export function isVirtualList(name) {
  return Object.prototype.hasOwnProperty.call(virtualLists, name);
}

/**
 * Resolve a list name to its lines. Physical lists are read via the injected
 * `readPhysical` (so this stays environment-agnostic / browser-safe); virtual
 * lists are assembled from their members with cross-member de-duplication and
 * an optional sfw/nsfw filter.
 * @param {string} name List name (physical or virtual).
 * @param {(n:string)=>(string[]|null)} readPhysical Reads a physical list's lines.
 * @param {Set<string>} [seen] Cycle guard (internal).
 * @returns {string[]|null} The resolved lines, or null if a physical list is missing.
 */
export function resolveListLines(name, readPhysical, seen = new Set()) {
  if (!isVirtualList(name)) return readPhysical(name);
  if (seen.has(name)) return [];
  seen.add(name);

  const def = virtualLists[name];
  const out = [];
  const seenLine = new Set();
  for (const member of def.union) {
    const lines = resolveListLines(member, readPhysical, seen) || [];
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (line.trim() === "") continue;
      if (seenLine.has(line)) continue;
      seenLine.add(line);
      out.push(line);
    }
  }
  if (def.filter === "sfw") return out.filter((l) => !isNsfw(l));
  if (def.filter === "nsfw") return out.filter((l) => isNsfw(l));
  return out;
}

/**
 * Class rank for a single character: symbols (0) sort before digits (1) before
 * letters (2). Gives a guaranteed, predictable ordering.
 * @param {string} ch A single character.
 * @returns {number} 0 symbol, 1 digit, 2 letter.
 */
function charRank(ch) {
  if (ch >= "0" && ch <= "9") return 1;
  const l = ch.toLowerCase();
  if (l >= "a" && l <= "z") return 2;
  return 0;
}

/**
 * Natural-order comparator giving a GUARANTEED load/precedence order: symbols
 * first, then numbers in true numeric order (so `2` before `10`), then letters
 * alphabetically. Lets users engineer a deterministic default by prefixing a
 * name with a symbol or number.
 * @param {string} a First name.
 * @param {string} b Second name.
 * @returns {number} Negative, zero, or positive.
 */
export function compareNames(a, b) {
  a = String(a);
  b = String(b);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a[i];
    const cb = b[j];
    if (ca >= "0" && ca <= "9" && cb >= "0" && cb <= "9") {
      let ni = i;
      let nj = j;
      while (ni < a.length && a[ni] >= "0" && a[ni] <= "9") ni++;
      while (nj < b.length && b[nj] >= "0" && b[nj] <= "9") nj++;
      const na = parseInt(a.slice(i, ni), 10);
      const nb = parseInt(b.slice(j, nj), 10);
      if (na !== nb) return na - nb;
      i = ni;
      j = nj;
      continue;
    }
    const ra = charRank(ca);
    const rb = charRank(cb);
    if (ra !== rb) return ra - rb;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i++;
    j++;
  }
  return a.length - i - (b.length - j);
}

/**
 * @param {string[]} physicalNames The on-disk list names.
 * @returns {string[]} Physical names plus all virtual-list names (de-duplicated),
 *   in the guaranteed natural order (see compareNames).
 */
export function allListNames(physicalNames) {
  return Array.from(new Set([...physicalNames, ...Object.keys(virtualLists)])).sort(compareNames);
}

/**
 * Resolve a list reference to a canonical list name by PATH-SUFFIX matching, so a
 * prompt can use a bare filename (`general`), a partial path (`danbooru/general`),
 * or a full path — and folders can be nested arbitrarily deep. An exact match wins;
 * otherwise any name whose path ends with `/<ref>` matches, and the shallowest
 * (fewest folders), then alphabetically-first, match is chosen for determinism.
 * @param {string} ref The reference as written in the prompt.
 * @param {string[]} names All known canonical names (physical paths + virtual names).
 * @returns {string} The resolved canonical name (or `ref` unchanged if nothing matches).
 */
export function resolveName(ref, names) {
  if (!ref) return ref;
  if (names.includes(ref)) return ref; // exact path or virtual name
  const suffix = `/${ref}`;
  const matches = names.filter((n) => n.endsWith(suffix));
  if (!matches.length) return ref;
  // Shallowest path wins (folders act as defaults); ties broken by the
  // guaranteed natural order (symbols < numbers < letters).
  matches.sort((a, b) => {
    const da = a.split("/").length;
    const db = b.split("/").length;
    return da !== db ? da - db : compareNames(a, b);
  });
  return matches[0];
}
