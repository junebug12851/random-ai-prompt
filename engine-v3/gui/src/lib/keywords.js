/**
 * Keyword extraction for the gallery / single view. Turns a real, sent-to-model prompt — full of
 * Stable-Diffusion / NovelAI weighting and attention syntax — into a clean list of human-readable
 * keyword tags.
 *
 * The old engine reduced every tag to bare `[a-z0-9]` (de-accenting along the way), which is great
 * for matching but throws away anything that isn't ASCII and mangles multi-word tags. Here we keep
 * the readable, accented **display** form of each tag (so "café", "naïve", non-Latin scripts all
 * survive) and compute a separate de-accented, lowercased **key** used only for de-duping and for
 * gallery search matching (so typing "cafe" still finds "café", and "café"/"cafe" collapse to one
 * chip). Best of both: faithful display, robust matching.
 * @module gui/lib/keywords
 */

/**
 * De-accent + lowercase a string into a match/dedupe key. Unicode NFKD splits accented letters into
 * a base letter + a combining diacritic, which we then strip — so "Café" → "cafe". Non-Latin scripts
 * (which have no diacritics to strip) pass through unchanged, just lowercased.
 * @param {string} s The display tag.
 * @returns {string} The normalized key (de-accented, lowercased, single-spaced).
 */
export function keywordKey(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip one raw comma-separated fragment of prompt weighting/attention syntax down to its readable
 * tag text. Handles: `<lora:foo:0.8>` / `<embedding>` (dropped), `(word:1.2)` and `((word))` and
 * `[word]` / `{word}` attention brackets (kept inner, brackets removed), explicit `:weight` numbers,
 * prompt-editing `[from:to:step]` colons, the `BREAK`/`AND` keywords, and pipe `|` alternation. Any
 * leftover leading/trailing punctuation is trimmed.
 * @param {string} raw One fragment (between commas).
 * @returns {string} The cleaned, display-ready tag (possibly empty).
 */
function cleanTag(raw) {
  let s = String(raw || "");
  s = s.replace(/<[^>]*>/g, " "); // drop <lora:…>, <hypernet:…>, <embedding> etc. entirely
  s = s.replace(/[()[\]{}]/g, " "); // remove attention brackets, keep their contents
  s = s.replace(/:\s*-?\d+(?:\.\d+)?/g, " "); // strip explicit ":1.2" style weights
  s = s.replace(/:/g, " "); // remaining colons (prompt-editing "from:to") → space
  s = s.replace(/[|]/g, " "); // alternation separators
  s = s.replace(/["'`]/g, ""); // stray quotes
  s = s.replace(/\b(?:BREAK|AND)\b/g, " "); // SDXL/Comfy section keywords
  s = s.replace(/\s+/g, " ").trim(); // collapse whitespace
  // Trim leading/trailing characters that aren't letters or numbers (keeps inner spaces/hyphens).
  s = s.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, "");
  return s;
}

/**
 * Parse a prompt string into clean, de-duplicated keyword tags.
 *
 * Splits on commas and newlines (the tag separators SD-style prompts actually use — phrases like
 * "looking at viewer" stay whole rather than being shattered into single words), cleans each tag of
 * weighting syntax, de-dupes by normalized key, and drops empties / absurdly long fragments.
 * @param {string} text The prompt text.
 * @param {object} [opts]
 * @param {boolean} [opts.sort=false] Alphabetize the result (by normalized key).
 * @param {number} [opts.max=80] Cap on how many tags to return.
 * @param {number} [opts.maxLen=48] Drop any single tag longer than this (likely a run-on phrase).
 * @returns {Array<{display: string, key: string}>} Tags with their display + match forms.
 */
export function parseKeywords(text, opts = {}) {
  const { sort = false, max = 80, maxLen = 48 } = opts;
  const out = [];
  const seen = new Set();
  for (const piece of String(text || "").split(/[,\n]+/)) {
    const display = cleanTag(piece);
    if (!display || display.length > maxLen) continue;
    const key = keywordKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ display, key });
  }
  if (sort) out.sort((a, b) => a.key.localeCompare(b.key));
  return out.slice(0, max);
}

/**
 * Convenience: parsed keyword **display** strings only (de-duped, optionally sorted).
 * @param {string} text The prompt text.
 * @param {object} [opts] See {@link parseKeywords}.
 * @returns {string[]} The display tags.
 */
export function extractKeywords(text, opts) {
  return parseKeywords(text, opts).map((k) => k.display);
}

/**
 * Clean + de-dupe an already-separated list of keyword strings (e.g. an AI's comma reply that we've
 * split), optionally alphabetized. Reuses the same cleaning + key rules as {@link parseKeywords}.
 * @param {string[]} list Raw keyword strings.
 * @param {object} [opts] See {@link parseKeywords}.
 * @returns {string[]} The cleaned, de-duped display tags.
 */
export function normalizeKeywordList(list, opts = {}) {
  return extractKeywords((list || []).join("\n"), opts);
}
