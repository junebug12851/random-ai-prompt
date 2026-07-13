/**
 * @file Pure list-editor operations: parsing an AI "expand" reply into clean candidate entries,
 * merging in only the new ones, de-duplication, and alphabetical sorting.
 *
 * These operate on **list content**, which is engine domain — a list is one of the engine's two
 * content pools, and "what counts as a duplicate entry" is a property of the engine's lists, not of
 * any one UI. So this lives in `engine/` and **every target imports it**: the web's Manage list
 * editor (`components/ManageListEditor.jsx`) and the mobile one (`screens/ManageScreen.js`). It used
 * to live inside the web target with a byte-for-byte hand-ported copy in mobile, kept honest by a
 * drift check (`checkListOps`) that is now deleted — you cannot drift from yourself.
 *
 * Side-effect-free (no React, no RN, no I/O), so it's unit-tested directly and is safe under all
 * three loaders (Node / browser / Metro). See `notes/plans/de-duplication.md`.
 */

/**
 * Parse an AI "expand" reply into clean candidate entries — one per line, tolerating a stray
 * `- ` / `1. ` / `• ` list prefix; falls back to comma-separated when the reply is a single line.
 * @param {string} out The raw model reply.
 * @returns {string[]} The candidate entries (trimmed, non-empty).
 */
export function parseAiCandidates(out) {
  let candidates = (out || "")
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-*•]?\s*\d*[.)]?\s*/, "").trim())
    .filter(Boolean);
  if (candidates.length <= 1)
    candidates = (out || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return candidates;
}

/**
 * The candidates not already present in `pool` (case-insensitive), de-duplicated against each other,
 * in their original order.
 * @param {string[]} pool The existing entries.
 * @param {string[]} candidates The proposed new entries.
 * @returns {string[]} The net-new entries.
 */
export function mergeNew(pool, candidates) {
  const have = new Set(pool.map((l) => l.toLowerCase()));
  const added = [];
  for (const c of candidates) {
    const k = c.toLowerCase();
    if (have.has(k)) continue;
    have.add(k);
    added.push(c);
  }
  return added;
}

/**
 * Drop duplicate entries (case-insensitive, trimmed; keeps the first occurrence and original order).
 * @param {string[]} lines The entries.
 * @returns {{lines: string[], removed: number}} The de-duplicated entries and how many were removed.
 */
export function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const key = l.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return { lines: out, removed: lines.length - out.length };
}

/**
 * Sort entries alphabetically (case-insensitive, locale-aware). Non-mutating.
 * @param {string[]} lines The entries.
 * @returns {string[]} A new, sorted array.
 */
export function sortLines(lines) {
  return lines.slice().sort((x, y) => x.trim().toLowerCase().localeCompare(y.trim().toLowerCase()));
}
