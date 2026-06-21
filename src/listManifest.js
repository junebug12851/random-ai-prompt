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
 * A COMPOSITE list is a `.group` file: a union of other lists (resolved like any
 * reference) rather than a file on disk. This is how the project "collapses lists
 * into others": the big duplicated files the build scripts used to emit (danbooru,
 * d/keyword, d/character, artist, artist-digipa) are now computed on demand from
 * their atomic parts, with cross-member de-duplication. There is NO runtime content
 * filtering — SFW/NSFW are preprocessed into separate files: `<name>-sfw.txt` (SFW)
 * and `<name>-nsfw.txt` (NSFW-only), with the bare `{name}` implicit. `logicalListNames`
 * derives the reference set; `resolveListLines` combines the files per `includeAdult`.
 *
 * `listTags` records per-list metadata (category + anime/nsfw flags) for the UI
 * and for documentation; it does not gate anything by itself (gating stays in
 * gatedLists.js).
 */

/**
 * Per-list metadata. Any list not listed here defaults to
 * { anime:false, nsfw:false }. `nsfw:true` means the list as a whole leans
 * adult (still drawn only when includeAdult is on if it is also gated).
 * @type {Object<string,{category?:string,anime?:boolean,nsfw?:boolean}>}
 */
export const listTags = {
  // danbooru / anime content (files live under danbooru/d/, short ref "d/<name>").
  // Plain names are SFW; `-nsfw` / `-nsfw-only` carry NSFW and are gated.
  "danbooru/d/d": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/general": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/general-nsfw": { category: "danbooru", anime: true, nsfw: true },
  "danbooru/d/artist": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-c": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-nc": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/meta": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/keyword": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/person": { category: "danbooru", anime: true, nsfw: false },
  "keyword/keyword-nsfw": { category: "keyword", anime: false, nsfw: true },
  "artist/anime": { category: "artist", anime: true, nsfw: false },
  "name/anime-name": { category: "subject", anime: true, nsfw: false },
  "artist/nudity-nsfw": { category: "artist", anime: false, nsfw: true },

  // uncategorized leftover words (function words, obscure terms WordNet lacks)
  "word/misc": { category: "pos", anime: false, nsfw: false },

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

  // face/expression/pose tags + gated adult relocations
  "look/expression": { category: "expression", anime: false, nsfw: false },
  "look/action": { category: "action", anime: false, nsfw: false },
  "look/clothes-nsfw": { category: "look", anime: false, nsfw: true },
  "word/adult-nsfw": { category: "pos", anime: false, nsfw: true },
};

// Composite lists are plain files: a `<name>.group` file whose lines are each a
// list reference (resolved like any {name}). Groups may include groups up to
// MAX_GROUP_DEPTH levels deep, with a cycle guard. See data/lists/README.md.

/** Recursion cutoff for group-includes-group nesting. */
export const MAX_GROUP_DEPTH = 3;

/** Suffix tokens that select an exclusive SFW or NSFW-inclusive variant. */
const SFW_SUFFIX = /-sfw$/i;
const NSFW_SUFFIX = /-nsfw$/i;

/**
 * Reserved wildcard base. `{keyword}` (and `{keyword-sfw}` / `{keyword-nsfw}`) are
 * not files — they resolve to a random word drawn from ALL loaded vocabulary
 * (mode-aware). The name is reserved: it always supersedes any list literally named
 * `keyword`, silently (no error), the same way `nsfw` is a reserved filename token.
 * @type {string}
 */
export const RESERVED_WILDCARD = "keyword";

/**
 * @param {string} name A reference (may carry a `-sfw`/`-nsfw` suffix).
 * @returns {boolean} Whether it is the reserved `keyword` wildcard (any variant).
 */
export function isReservedWildcard(name) {
  return String(name).replace(/-(sfw|nsfw)$/i, "") === RESERVED_WILDCARD;
}

/**
 * Read a plain list's SFW base lines. **Safety rule:** when a `<base>-nsfw` sibling
 * exists, a plain `<base>.txt` is IGNORED — the SFW source must be the explicit
 * `<base>-sfw.txt`. This enforces the naming split so a stray `<base>.txt` can never
 * leak as SFW alongside NSFW (a lone `<base>.txt` beside `<base>-nsfw.txt` is thus
 * treated as NSFW-only). With no `<base>-nsfw` sibling, a plain `<base>.txt` is a
 * normal SFW list (with `<base>-sfw.txt` as a fallback). Returns `null` when no SFW
 * source exists, else an array (possibly empty).
 * @param {string} base Canonical base name (no sfw/nsfw suffix).
 * @param {{names:string[], readListFile:(n:string)=>(string[]|null)}} readers
 * @returns {string[]|null}
 */
function readSfwBase(base, readers) {
  if (readers.names.includes(`${base}-nsfw`)) return readers.readListFile(`${base}-sfw`);
  return readers.readListFile(base) ?? readers.readListFile(`${base}-sfw`);
}

/**
 * Resolve a list/group reference to its lines, honoring the SFW/NSFW naming model
 * and the `includeAdult` mode. No runtime content filtering — NSFW is a separate
 * preprocessed `<base>-nsfw.txt` file that is simply included or not.
 *
 * Semantics (per reference):
 * - `{name}`        → SFW only when adult is off; SFW + `<name>-nsfw` when on.
 * - `{name-sfw}`    → SFW base only (always; the explicit SFW-exclusive reference).
 * - `{name-nsfw}`   → nothing when adult is off (acts as if it doesn't exist);
 *                     SFW + `<name>-nsfw` when on (the SFW base is auto-tacked on).
 *
 * Groups propagate the resolved variant to their members, so `{d}` (off) is
 * all-SFW, `{d}` (on) includes NSFW, and `{d-sfw}` is SFW even when on.
 *
 * @param {string} name Canonical list/group name (may carry a `-sfw`/`-nsfw` suffix).
 * @param {{names:string[], readListFile:(n:string)=>(string[]|null), readGroupFile:(n:string)=>(string[]|null)}} readers
 * @param {boolean} [includeAdult] Whether adult/NSFW content is enabled.
 * @param {("sfw"|"full"|null)} [forced] Variant forced by a parent group (internal).
 * @param {number} [depth] Current group-nesting depth (internal).
 * @param {Set<string>} [seen] Cycle guard (internal).
 * @returns {string[]|null} Resolved lines, or null if a plain list is missing.
 */
export function resolveListLines(
  name,
  readers,
  includeAdult = false,
  forced = null,
  depth = 0,
  seen = new Set(),
) {
  // Determine the base name and the variant ("sfw" = SFW only, "full" = SFW+NSFW).
  let base = name;
  let variant;
  if (NSFW_SUFFIX.test(name)) {
    base = name.replace(NSFW_SUFFIX, "");
    // An explicit -nsfw reference is invisible unless adult is on, and a parent
    // forcing SFW excludes it entirely.
    if (forced === "sfw" || !includeAdult) return [];
    variant = "full";
  } else if (SFW_SUFFIX.test(name)) {
    base = name.replace(SFW_SUFFIX, "");
    variant = "sfw";
  } else {
    variant = forced ?? (includeAdult ? "full" : "sfw");
  }

  // Reserved `keyword` wildcard: a random word from ALL general vocabulary, drawn
  // mode-aware. Not a file — supersedes any list literally named `keyword`. Excludes
  // the specialized artist/* and danbooru/* namespaces (they have their own modes),
  // and of course excludes itself. `{keyword}` = SFW off / +NSFW on; `{keyword-sfw}`
  // = SFW always; `{keyword-nsfw}` = SFW+NSFW (and invisible when adult is off, handled
  // by the -nsfw suffix branch above).
  if (base === RESERVED_WILDCARD) {
    const out = [];
    const seenLine = new Set();
    const bases = new Set();
    for (const n of readers.names) {
      if (n.includes("artist") || n.startsWith("danbooru/")) continue;
      if (readers.readGroupFile(n) != null) continue; // members covered via their lists
      const b = n.replace(/-(sfw|nsfw)$/i, "");
      if (b === RESERVED_WILDCARD) continue;
      bases.add(b);
    }
    for (const b of bases) {
      const lines = resolveListLines(b, readers, includeAdult, variant, depth + 1, seen) || [];
      for (const l of lines) {
        const t = l.replace(/\r$/, "");
        if (t.trim() === "" || seenLine.has(t)) continue;
        seenLine.add(t);
        out.push(t);
      }
    }
    return out;
  }

  // Re-resolve the (suffix-stripped) base to its canonical name, so an explicit
  // variant like {d-sfw} maps to the group/list path {d} resolves to.
  base = resolveName(base, readers.names);

  // Group? Union of members, each resolved with the inherited variant.
  const groupLines = readers.readGroupFile(base);
  if (groupLines != null) {
    if (seen.has(base) || depth >= MAX_GROUP_DEPTH) return [];
    seen.add(base);

    const out = [];
    const seenLine = new Set();
    for (const raw of groupLines) {
      const line = raw.replace(/\r$/, "").trim();
      if (line === "" || line.startsWith("#") || line.startsWith("@")) continue;
      const member = resolveName(line, readers.names);
      const lines =
        resolveListLines(member, readers, includeAdult, variant, depth + 1, seen) || [];
      for (const l of lines) {
        const t = l.replace(/\r$/, "");
        if (t.trim() === "" || seenLine.has(t)) continue;
        seenLine.add(t);
        out.push(t);
      }
    }
    return out;
  }

  // Plain list. SFW base + (NSFW extra when the variant is full).
  const sfw = readSfwBase(base, readers);
  if (variant === "sfw") return sfw == null ? null : [...sfw];
  const nsfw = readers.readListFile(`${base}-nsfw`) ?? [];
  if (sfw == null && nsfw.length === 0) return null;
  return [...(sfw ?? []), ...nsfw];
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
 * @param {string[]} names The on-disk list + group names (no extension).
 * @returns {string[]} De-duplicated, in the guaranteed natural order (compareNames).
 */
export function allListNames(names) {
  return Array.from(new Set(names)).sort(compareNames);
}

/**
 * @param {string} name A list/group name.
 * @returns {boolean} Whether it ends in an explicit `-sfw`/`-nsfw` variant suffix.
 */
export function hasVariantSuffix(name) {
  return SFW_SUFFIX.test(name) || NSFW_SUFFIX.test(name);
}

/**
 * Turn the physical on-disk names into the LOGICAL reference set, the names the rest
 * of the app sees. A mixed list is stored as two files, `<base>-sfw` and `<base>-nsfw`,
 * with NO `<base>` file — the bare `{base}` is implicit, and this exposes all three
 * references (`base`, `base-sfw`, `base-nsfw`). A standalone `<base>-nsfw` with no
 * `<base>-sfw` counterpart is exposed only by its gated `-nsfw` name (NSFW-only).
 *
 * **Safety rule:** a plain `<p>` file is only a normal SFW list when it has NO
 * `<p>-nsfw` sibling; if such a sibling exists the plain file is IGNORED (not exposed,
 * not loaded), to force the explicit `-sfw`/`-nsfw` split. Only `<base>-sfw` counts as
 * an SFW source — a stray `<base>` next to `<base>-nsfw` does not.
 * @param {string[]} physical The on-disk list + group names (no extension).
 * @returns {string[]} Logical names, de-duplicated, in guaranteed natural order.
 */
export function logicalListNames(physical) {
  const P = new Set(physical);
  const out = new Set();
  for (const p of physical) {
    if (SFW_SUFFIX.test(p)) {
      const base = p.replace(SFW_SUFFIX, "");
      out.add(base);
      out.add(`${base}-sfw`);
      if (P.has(`${base}-nsfw`)) out.add(`${base}-nsfw`);
    } else if (NSFW_SUFFIX.test(p)) {
      const base = p.replace(NSFW_SUFFIX, "");
      out.add(p);
      if (P.has(`${base}-sfw`)) {
        // genuine mixed pair -> also expose the implicit base + explicit SFW ref
        out.add(base);
        out.add(`${base}-sfw`);
      }
    } else if (!P.has(`${p}-nsfw`)) {
      // plain SFW list; ignored entirely if a `${p}-nsfw` sibling exists (safety rule)
      out.add(p);
    }
  }
  return Array.from(out).sort(compareNames);
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
  // Reserved `keyword` wildcard (any variant) supersedes everything — never resolve
  // it to a file path (e.g. it must NOT match danbooru/d/keyword by suffix).
  if (isReservedWildcard(ref)) return ref;
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
