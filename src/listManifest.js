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
  // danbooru / anime content
  danbooru: { category: "danbooru", anime: true, nsfw: true },
  "danbooru-sfw": { category: "danbooru", anime: true, nsfw: false },
  "d-general": { category: "danbooru", anime: true, nsfw: true },
  "d-artist": { category: "danbooru", anime: true, nsfw: false },
  "d-character": { category: "danbooru", anime: true, nsfw: false },
  "d-character-c": { category: "danbooru", anime: true, nsfw: false },
  "d-character-nc": { category: "danbooru", anime: true, nsfw: false },
  "d-meta": { category: "danbooru", anime: true, nsfw: false },
  "d-keyword": { category: "danbooru", anime: true, nsfw: true },
  "d-person": { category: "danbooru", anime: true, nsfw: false },
  "keyword-adult": { category: "keyword", anime: false, nsfw: true },
  "artist-anime": { category: "artist", anime: true, nsfw: false },
  "anime-name": { category: "subject", anime: true, nsfw: false },
  "artist-nudity": { category: "artist", anime: false, nsfw: true },

  // dictionary-derived part-of-speech lists (general English, sfw)
  "dict-adjective": { category: "pos", anime: false, nsfw: false },
  "dict-noun": { category: "pos", anime: false, nsfw: false },
  "dict-verb": { category: "pos", anime: false, nsfw: false },
  "dict-adverb": { category: "pos", anime: false, nsfw: false },
  "dict-misc": { category: "pos", anime: false, nsfw: false },
};

/**
 * Virtual (composite) lists, computed from other lists.
 * `union` lists the member lists (de-duplicated, in order). `filter` optionally
 * keeps only sfw or only nsfw lines.
 * @type {Object<string,{union:string[],filter?:("sfw"|"nsfw")}>}
 */
export const virtualLists = {
  // --- collapsed danbooru composites (were duplicated files on disk) ---
  "d-character": { union: ["d-character-nc", "d-character-c"] },
  "d-keyword": { union: ["d-general", "d-character-c", "d-character-nc", "d-meta"] },
  danbooru: { union: ["d-general", "d-artist", "d-character-c", "d-character-nc", "d-meta"] },
  // SFW view of danbooru — the clean anime list, no second file to maintain
  "danbooru-sfw": { union: ["danbooru"], filter: "sfw" },

  // --- collapsed artist composites ---
  "artist-digipa": { union: ["artist-dhigh", "artist-dmed", "artist-dlow"] },
  artist: {
    union: [
      "artist-anime", "artist-bw", "artist-cartoon", "artist-dhigh",
      "artist-dmed", "artist-dlow", "artist-fareast", "artist-fineart",
      "artist-nudity", "artist-scribbles", "artist-special", "artist-ukioe",
      "artist-weird",
    ],
  },

  // --- curated + dictionary, combined (quality default stays separate) ---
  "adjective-all": { union: ["adjective", "dict-adjective"] },
  "noun-all": { union: ["noun", "dict-noun"] },
  "verb-all": { union: ["verb", "dict-verb"] },
  "adverb-all": { union: ["adverb", "dict-adverb"] },
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
 * @param {string[]} physicalNames The on-disk list names.
 * @returns {string[]} Physical names plus all virtual-list names (de-duplicated).
 */
export function allListNames(physicalNames) {
  return Array.from(new Set([...physicalNames, ...Object.keys(virtualLists)]));
}
