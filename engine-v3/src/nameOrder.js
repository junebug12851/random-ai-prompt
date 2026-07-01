/**
 * @file
 * @brief List/group NAME logic: the SFW/NSFW variant suffixes, the reserved `keyword` wildcard,
 * the guaranteed natural-order comparator, the physical→logical reference set, suffix-path
 * resolution, and the shortest-unambiguous display tokens. Pure, browser-safe.
 */

/** Suffix tokens that select an exclusive SFW or NSFW-inclusive variant. */
export const SFW_SUFFIX = /-sfw$/i;
export const NSFW_SUFFIX = /-nsfw$/i;

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

/** @param {string} ch A single character. @returns {boolean} Whether it is an ASCII digit. */
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

/** @returns {number} The index just past the run of digits in `s` starting at `start`. */
function scanDigits(s, start) {
  let k = start;
  while (k < s.length && isDigit(s[k])) k++;
  return k;
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
    if (isDigit(ca) && isDigit(cb)) {
      const ni = scanDigits(a, i);
      const nj = scanDigits(b, j);
      const na = Number.parseInt(a.slice(i, ni), 10);
      const nb = Number.parseInt(b.slice(j, nj), 10);
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
    return da === db ? compareNames(a, b) : da - db;
  });
  return matches[0];
}

/**
 * The display token from the highest (closest-to-root) forced ancestor folder of `segs` down, or
 * null when no ancestor folder is forced.
 * @param {string[]} segs The name's `/`-split segments.
 * @param {Set<string>} forced Folders marked with a `.force-prefix` file.
 * @returns {string|null}
 */
function forcedToken(segs, forced) {
  for (let k = 0; k < segs.length - 1; k++) {
    if (forced.has(segs.slice(0, k + 1).join("/"))) return segs.slice(k).join("/");
  }
  return null;
}

/**
 * Grow each auto name's shown-folder depth (in `shown`) by one per round until no two names share a
 * token — the collision-resolution fixpoint.
 * @param {string[]} auto The names being auto-tokenized.
 * @param {Map<string, number>} shown name → folders currently shown (mutated).
 * @param {(n: string) => string} tok Current token for a name given `shown`.
 */
function growUntilDistinct(auto, shown, tok) {
  for (let changed = true; changed;) {
    changed = false;
    const groups = {};
    for (const n of auto) {
      const key = tok(n);
      groups[key] ??= [];
      groups[key].push(n);
    }
    for (const members of Object.values(groups)) {
      if (members.length < 2) continue;
      for (const n of members) {
        if (shown.get(n) < n.split("/").length) {
          shown.set(n, shown.get(n) + 1);
          changed = true;
        }
      }
    }
  }
}

/**
 * Compute the SHORTEST unambiguous display token for each list, for editor buttons.
 * By default a list shows just its filename; a name only grows a folder prefix when
 * it would otherwise be ambiguous.
 *
 * Two stages:
 * 1. **Manual prefix (`.force-prefix`)** — any name under a folder marked with a
 *    `.force-prefix` file shows its path from the highest such ancestor down (e.g.
 *    `danbooru/d/general` → `d/general`). These are excluded from the auto step, so
 *    they never push a prefix onto anyone else.
 * 2. **Auto prefix** — the rest start at the bare filename; whenever two share a
 *    token they each step out one more folder until distinct.
 *
 * A final pass guarantees every token `resolveName()`s back to its own canonical
 * name (lengthening if a forced/other name would otherwise shadow it).
 * @param {string[]} names Canonical (logical) list names.
 * @param {string[]} [forcedDirs] Folders that contain a `.force-prefix` marker.
 * @returns {Object<string,string>} Map of canonical name → display token.
 */
export function computeButtonNames(names, forcedDirs = []) {
  const forced = new Set(forcedDirs);
  const result = {};
  const auto = [];

  for (const name of names) {
    const token = forcedToken(name.split("/"), forced);
    if (token !== null) result[name] = token;
    else auto.push(name);
  }

  // Auto: bare filename, lengthened by one folder per round while any collide.
  const shown = new Map(auto.map((n) => [n, 1]));
  const tok = (n) => {
    const s = n.split("/");
    return s.slice(s.length - shown.get(n)).join("/");
  };
  growUntilDistinct(auto, shown, tok);
  for (const n of auto) result[n] = tok(n);

  // Guarantee each token resolves back to its own name (vs forced/other shadows).
  for (const name of names) {
    const segs = name.split("/");
    let len = result[name].split("/").length;
    while (resolveName(result[name], names) !== name && len < segs.length) {
      len++;
      result[name] = segs.slice(segs.length - len).join("/");
    }
  }
  return result;
}
