/**
 * @file
 * @brief Emphasis stage: translate typed `((( )))` / `[[[ ]]]` emphasis into the active dialect.
 */

// The engine treats emphasis as a RENDERING FEATURE of its own syntax, not an AI-specific one:
// the author (or a DPL block) types nested `()` to emphasize and `[]` to de-emphasize a phrase,
// and this late stage renders that intent into whatever the target dialect understands — a numeric
// weight for Stable Diffusion / Midjourney, native nested braces for NovelAI, and a natural-language
// intensifier word for plain-text targets (ComfyUI, OpenAI, …) that have no weighting grammar.
//
// Each bracket level is ±10 intensity off a default of 50, capped at 5 levels: `(x)`=60 … `(((((x)))))`
// =100; `[x]`=40 … `[[[x]]]`=20 … 5 levels = 1 (floored — never 0). This COEXISTS with the per-keyword
// random roll (`randomEmphasis.js`): the roll decides which list keywords get bracketed; this stage is
// the single place that renders ALL bracket emphasis (typed or rolled) into the dialect form. It runs
// after the `{list}` / `{#gen}` expansion, so it also covers emphasis written inside DPL blocks (whose
// output is just prompt text by this point).
//
// What it deliberately leaves alone (passes through verbatim):
//   - an explicit weight the author typed — `(phrase:1.2)` (the inner `:` opts out)
//   - NovelAI alternation — `[a|b|c]` (the inner `|` opts out; it is a NovelAI-only render feature the
//     engine does not own, so it bleeds through untouched)
//   - a bare `[123]` numeric weight or a leftover `[i<10%]`-style dial token (digits / `%`)
//   - asymmetric bracket runs (open count ≠ close count) — not a clean emphasis group

import { intensityWord } from "../dpl/dpl.js";

// One `(`/`[` per level = ±10 intensity; 5 levels reaches the 100 ceiling / the 1 floor.
const TYPED_MAX_LEVELS = 5;
const DEFAULT_INTENSITY = 50;

/** Bracket depth (≥1) → intensity percent. De-emphasis floors at 1 (never 0); emphasis caps at 100. */
function depthToIntensity(depth, lessEmphasis) {
  const lvl = Math.min(depth, TYPED_MAX_LEVELS);
  return lessEmphasis
    ? Math.max(1, DEFAULT_INTENSITY - 10 * lvl)
    : Math.min(100, DEFAULT_INTENSITY + 10 * lvl);
}

/** A dialect weight number for an intensity (50 = ×1.0): trimmed to ≤2 decimals, no trailing zeros. */
function weightFor(intensity) {
  return Number((intensity / DEFAULT_INTENSITY).toFixed(2)).toString();
}

/**
 * Render one emphasis group into the active dialect.
 * @param {string} mode The engine mode (`StableDiffusion` | `NovelAI` | `Midjourney` | other → plain).
 * @param {string} phrase The inner text.
 * @param {number} depth The bracket depth (≥1).
 * @param {boolean} lessEmphasis De-emphasis (`[]`) rather than emphasis (`()`).
 * @returns {string} The dialect-rendered phrase.
 */
function renderEmphasis(mode, phrase, depth, lessEmphasis) {
  const intensity = depthToIntensity(depth, lessEmphasis);
  const lvl = Math.min(depth, TYPED_MAX_LEVELS);
  if (mode === "NovelAI") {
    // NovelAI's native form: `{}` raises, `[]` lowers, one pair per ~5% step.
    const [o, c] = lessEmphasis ? ["[", "]"] : ["{", "}"];
    return o.repeat(lvl) + phrase + c.repeat(lvl);
  }
  if (mode === "Midjourney") return `${phrase}::${weightFor(intensity)}`;
  if (mode === "StableDiffusion") return `(${phrase}:${weightFor(intensity)})`;
  // Plain / natural language (ComfyUI, OpenAI, …): a leading intensity word, no syntax.
  return `${intensityWord(intensity)} ${phrase}`;
}

// A balanced, symmetric run of N opening brackets, an inner with none of the bracket/`|`/`:` chars,
// then N closing brackets. The `|`/`:` exclusions are what let `(x:1.2)` weights and `[a|b]` NovelAI
// alternation pass through untouched (they simply don't match).
// The `(?=(\(+))\1` prefix captures the opening run in a lookahead then re-consumes it via the
// backreference — an atomic-group emulation that stops the `+` from backtracking (JS has no atomic
// groups), so a long run of unmatched brackets can't cause super-linear runtime. Capture groups are
// unchanged: 1 = opening run, 2 = inner, 3 = closing run.
const PAREN_RE = /(?=(\(+))\1([^()|:]+?)(\)+)/g;
const BRACK_RE = /(?=(\[+))\1([^[\]|:]+?)(\]+)/g;

/** Replace every clean emphasis group via `re` (one capture: open run, inner, close run). */
function convert(text, re, mode, lessEmphasis) {
  return text.replace(re, (m, open, inner, close) => {
    if (open.length !== close.length) return m; // asymmetric → not an emphasis group
    const phrase = inner.trim();
    if (phrase === "") return m;
    // De-emphasis brackets must not swallow a bare `[123]` weight or a `%`-bearing dial leftover.
    if (lessEmphasis && (/^\d+$/.test(phrase) || phrase.includes("%"))) return m;
    return renderEmphasis(mode, phrase, open.length, lessEmphasis);
  });
}

/**
 * The emphasis stage: render typed `()` / `[]` emphasis into the active dialect.
 * @param {string} prompt The (already list/gen-expanded) prompt text.
 * @param {object} settings The merged settings (reads `settings.mode`).
 * @returns {string} The prompt with emphasis rendered for the dialect.
 */
export default function emphasis(prompt, settings = {}) {
  const mode = settings.mode || "StableDiffusion";
  let out = convert(prompt, PAREN_RE, mode, false);
  out = convert(out, BRACK_RE, mode, true);
  return out;
}
