/**
 * @file
 * @brief List/group LINE resolution: turn a `{name}` reference into its lines, honoring the
 * SFW/NSFW naming model and `includeAdult`, including composite `.group` unions and implied-group
 * folders (with a depth + cycle guard). Pure, browser-safe; names resolve via ./nameOrder.js.
 *
 * A COMPOSITE list is a `.group` file: a union of other lists (resolved like any reference) rather
 * than a file on disk. There is NO runtime content filtering — SFW/NSFW are preprocessed into
 * separate files (`<name>-sfw.txt` / `<name>-nsfw.txt`), combined here per `includeAdult`.
 */

import { resolveName, RESERVED_WILDCARD, SFW_SUFFIX, NSFW_SUFFIX } from "./nameOrder.js";

/** Recursion cutoff for group-includes-group nesting. */
export const MAX_GROUP_DEPTH = 3;

/**
 * Read a plain list's SFW base lines. **Safety rule:** when a `<base>-nsfw` sibling
 * exists, a plain `<base>.txt` is IGNORED — the SFW source must be the explicit
 * `<base>-sfw.txt`. This enforces the naming split so a stray `<base>.txt` can never
 * leak as SFW alongside NSFW (a lone `<base>.txt` beside `<base>-nsfw.txt` is thus
 * treated as NSFW-only). With no `<base>-nsfw` sibling, a plain `<base>.txt` is a
 * normal SFW list (with `<base>-sfw.txt` as a fallback). Returns `null` when no SFW
 * source exists, else an array (possibly empty).
 * @param {string} base Canonical base name (no sfw/nsfw suffix).
 * @param {{names: string[], readListFile: function(string): (string[]|null)}} readers
 * @returns {string[]|null}
 */
function readSfwBase(base, readers) {
  if (readers.names.includes(`${base}-nsfw`)) return readers.readListFile(`${base}-sfw`);
  return readers.readListFile(base) ?? readers.readListFile(`${base}-sfw`);
}

/**
 * Member reference lines for an IMPLIED group (a `.force-group-list` folder): the
 * folder's OWN direct list files only (NOT descendants — implied groups don't stack),
 * de-duplicated to base names (so `-sfw`/`-nsfw` pairs become one member resolved
 * mode-aware), excluding real groups. The result feeds the normal group-union path.
 * @param {string} dir The folder path.
 * @param {{names: string[], readGroupFile: function(string): (string[]|null)}} readers
 * @returns {string[]} Member reference lines.
 */
function impliedGroupMembers(dir, readers) {
  const seen = new Set();
  const out = [];
  for (const n of readers.names) {
    if (!n.startsWith(`${dir}/`)) continue;
    if (n.slice(dir.length + 1).includes("/")) continue; // direct children only
    if (readers.readGroupFile(n) != null) continue; // skip real groups
    const b = n.replace(/-(sfw|nsfw)$/i, "");
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
}

/**
 * Folders that are IMPLIED groups: a folder with **2+ direct list files** is auto-marked
 * (referenceable as `{folder}` = union of its own lists). An `enable-group-list` marker
 * forces a folder on (even with one list); a `disable-group-list` marker forces it off.
 * Does NOT stack — only the folder's own direct lists count, not its subfolders.
 * @param {string[]} listNames Logical LIST names (txt-derived; groups excluded).
 * @param {string[]} [enableDirs] Folders forced on (`.enable-group-list`).
 * @param {string[]} [disableDirs] Folders forced off (`.disable-group-list`).
 * @returns {string[]} The implied-group folder paths.
 */
export function autoGroupListDirs(listNames, enableDirs = [], disableDirs = []) {
  const byDir = new Map(); // dir -> set of distinct base list names (variants collapsed)
  for (const n of listNames) {
    const base = n.replace(/-(sfw|nsfw)$/i, "");
    const i = base.lastIndexOf("/");
    if (i < 0) continue;
    const dir = base.slice(0, i);
    if (!byDir.has(dir)) byDir.set(dir, new Set());
    byDir.get(dir).add(base);
  }
  const dis = new Set(disableDirs);
  const en = new Set(enableDirs);
  const out = new Set();
  for (const [dir, bases] of byDir) {
    if (dis.has(dir)) continue;
    if (bases.size >= 2 || en.has(dir)) out.add(dir);
  }
  return [...out];
}

/**
 * Append the `\r`-stripped, non-empty, not-yet-seen lines from `lines` onto `out`.
 * @param {string[]} out Accumulator (mutated).
 * @param {Set<string>} seenLine Dedup set (mutated).
 * @param {string[]} lines Candidate lines.
 */
function pushUnique(out, seenLine, lines) {
  for (const l of lines) {
    const t = l.replace(/\r$/, "");
    if (t.trim() === "" || seenLine.has(t)) continue;
    seenLine.add(t);
    out.push(t);
  }
}

/**
 * Resolve a reference's base name + variant ("sfw" = SFW only, "full" = SFW+NSFW). An explicit
 * `-nsfw` reference is excluded (invisible) when adult is off or a parent forces SFW.
 * @returns {{base: string, variant: ("sfw"|"full"), excluded: false} | {excluded: true}}
 */
function resolveVariant(name, forced, includeAdult) {
  if (NSFW_SUFFIX.test(name)) {
    if (forced === "sfw" || !includeAdult) return { excluded: true };
    return { base: name.replace(NSFW_SUFFIX, ""), variant: "full", excluded: false };
  }
  if (SFW_SUFFIX.test(name)) {
    return { base: name.replace(SFW_SUFFIX, ""), variant: "sfw", excluded: false };
  }
  return { base: name, variant: forced ?? (includeAdult ? "full" : "sfw"), excluded: false };
}

/**
 * Reserved `keyword` wildcard: the union of ALL general vocabulary (mode-aware), excluding the
 * artist/* and danbooru/* namespaces, groups (covered via their lists), and itself.
 * @returns {string[]} De-duplicated lines.
 */
function resolveWildcard(readers, includeAdult, variant, depth, seen) {
  const out = [];
  const seenLine = new Set();
  const bases = new Set();
  for (const n of readers.names) {
    if (n.includes("artist") || n.startsWith("danbooru/")) continue;
    if (readers.readGroupFile(n) != null) continue; // members covered via their lists
    if (readers.groupListDirs?.includes(n)) continue; // implied group dir
    const b = n.replace(/-(sfw|nsfw)$/i, "");
    if (b === RESERVED_WILDCARD) continue;
    bases.add(b);
  }
  for (const b of bases) {
    pushUnique(
      out,
      seenLine,
      resolveListLines(b, readers, includeAdult, variant, depth + 1, seen) || [],
    );
  }
  return out;
}

/**
 * A group (real `.group` file or implied-group folder): the de-duplicated union of its members'
 * lines, propagating the resolved variant, with the depth + cycle guard.
 * @returns {string[]} De-duplicated lines.
 */
function resolveGroup(base, groupLines, readers, includeAdult, variant, depth, seen) {
  if (seen.has(base) || depth >= MAX_GROUP_DEPTH) return [];
  seen.add(base);
  const out = [];
  const seenLine = new Set();
  for (const raw of groupLines) {
    const line = raw.replace(/\r$/, "").trim();
    if (line === "" || line.startsWith("#") || line.startsWith("@")) continue;
    const member = resolveName(line, readers.names);
    pushUnique(
      out,
      seenLine,
      resolveListLines(member, readers, includeAdult, variant, depth + 1, seen) || [],
    );
  }
  return out;
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
 * @param {{names: string[], readListFile: function(string): (string[]|null), readGroupFile: function(string): (string[]|null)}} readers
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
  const v = resolveVariant(name, forced, includeAdult);
  if (v.excluded) return [];
  let base = v.base;
  const variant = v.variant;

  // Reserved `keyword` wildcard: a random word from ALL general vocabulary, drawn
  // mode-aware. Not a file — supersedes any list literally named `keyword`. Excludes
  // the specialized artist/* and danbooru/* namespaces (they have their own modes),
  // and of course excludes itself. `{keyword}` = SFW off / +NSFW on; `{keyword-sfw}`
  // = SFW always; `{keyword-nsfw}` = SFW+NSFW (and invisible when adult is off, handled
  // by the -nsfw suffix branch above).
  if (base === RESERVED_WILDCARD) {
    return resolveWildcard(readers, includeAdult, variant, depth, seen);
  }

  // Re-resolve the (suffix-stripped) base to its canonical name, so an explicit
  // variant like {d-sfw} maps to the group/list path {d} resolves to.
  base = resolveName(base, readers.names);

  // Group? Either a real `.group` file, or an IMPLIED group: a folder marked with a
  // `.force-group-list` file resolves to the union of all lists directly/under it.
  let groupLines = readers.readGroupFile(base);
  if (groupLines == null && readers.groupListDirs?.includes(base)) {
    groupLines = impliedGroupMembers(base, readers);
  }
  if (groupLines != null) {
    return resolveGroup(base, groupLines, readers, includeAdult, variant, depth, seen);
  }

  // Plain list. SFW base + (NSFW extra when the variant is full).
  const sfw = readSfwBase(base, readers);
  if (variant === "sfw") return sfw == null ? null : [...sfw];
  const nsfw = readers.readListFile(`${base}-nsfw`) ?? [];
  if (sfw == null && nsfw.length === 0) return null;
  return [...(sfw ?? []), ...nsfw];
}
