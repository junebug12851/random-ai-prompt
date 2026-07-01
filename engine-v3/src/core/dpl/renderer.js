/**
 * @file
 * @brief DPL renderer: run the flow over a parsed node tree, applying gates / choices /
 * repeats / dial conditions / references and weight-sorting each layer. `renderNodes` is the
 * entry point the compiler wires into each section's render. See notes/reference/dpl-design.md.
 */

import { condPasses, scaleCount, applyIntensityMod, clampIntensity } from "./intensity.js";
import { intensityWord, focusWord } from "./words.js";

const AUTO_WEIGHT_START = 1000; // first auto-assigned line weight; +1 per following line

// ---------------------------------------------------------------------------
// Rendering: run the flow, collect weighted pieces, sort within the layer
// ---------------------------------------------------------------------------

/**
 * Weighted-sort a list of `{ weight, text }` pieces (stable; ties keep document order) and
 * join the non-empty ones with ", ".
 * @param {Array<{weight: number, text: string}>} pieces The collected layer pieces.
 * @returns {string} The joined layer text.
 */
function joinPieces(pieces) {
  return pieces
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => a.weight - b.weight || a.i - b.i)
    .map((p) => p.text)
    .filter((s) => s && s.trim() !== "")
    .join(", ");
}

/**
 * Render an array of sibling nodes into one layer string (gates, choices, repeats, refs,
 * weighted local sort). `auto` tracks the running auto-weight (starts at 1000).
 * @param {Array} nodes Parsed sibling nodes.
 * @param {object} ctx The render context (settings, rng, bridge, sections).
 * @returns {string} The layer's rendered, weight-sorted text.
 */
export function renderNodes(nodes, ctx) {
  const pieces = [];
  let auto = AUTO_WEIGHT_START;
  let prevGateFailed = false;
  for (const node of nodes) {
    const weight = node.weight ?? auto;
    auto = (node.weight ?? auto) + 1;

    // Dial conditions (`[i<10%]`, `[f<40%]`): hard, deterministic include/exclude, evaluated BEFORE
    // any probability roll. A failed condition drops the line and is not a "failed gate" for
    // `otherwise`. Both an intensity and a focus condition may apply; both must pass to keep the line.
    if (
      (node.iCond && !condPasses(node.iCond, ctx.intensity)) ||
      (node.fCond && !condPasses(node.fCond, ctx.focus))
    ) {
      prevGateFailed = false;
      continue;
    }

    // Effective gate: an explicit gate (NN%/maybe/NN% chance/otherwise) always wins. A bare
    // *simple-clause* bullet (plain text / token / ref) defaults to 50%. Structural bullets
    // (one of / repeat / block) and plain (non-bullet) lines are unconditional. `gateBearing`
    // (an authored gate, not the default) is what an `otherwise` pairs against. A probability gate is
    // auto-scaled by the current intensity (`scaleGate`); the bare-`otherwise` gate of 1 is not.
    const gateBearing = node.gate != null || node.otherwise === true;
    let gate = node.gate;
    let scaleGate = node.scaleGate === true;
    if (gate == null && !node.otherwise) {
      const structural = node.choice || node.repeat || node.flow || node.block;
      if (node.bullet && !structural) {
        gate = 0.5;
        scaleGate = true;
      }
    }
    let run = true;
    if (node.otherwise) run = prevGateFailed;
    if (run && gate != null) {
      const g = scaleGate ? gate * (ctx.intensity / 100) : gate;
      run = ctx.rng.chance(g);
    }
    prevGateFailed = gateBearing ? !run : false;
    if (!run) continue;

    const text = renderNode(node, ctx);
    if (text && text.trim() !== "") pieces.push({ weight, text: text.trim() });
  }
  return joinPieces(pieces);
}

/**
 * Render a single parsed node to a string (without its sibling gate, which the caller applied).
 * @param {object} node A parsed node.
 * @param {object} ctx The render context.
 * @returns {string} The node's text contribution.
 */
function renderNode(node, ctx) {
  // Choice: pick 1..N options (weighted by each option's leading %), honoring a miss chance. The
  // pick count is scaled by intensity, so low intensity yields fewer (possibly zero) picks.
  if (node.choice) {
    if (node.choice.miss && ctx.rng.chance(node.choice.miss)) return "";
    const opts = node.children.slice();
    if (!opts.length) return "";
    const hi = Math.min(scaleCount(node.choice.max, ctx.intensity), opts.length);
    const lo = Math.min(scaleCount(node.choice.min, ctx.intensity), hi);
    const count = ctx.rng.int(lo, hi);
    if (count <= 0) return "";
    const picked = weightedSampleN(opts, count, ctx.rng);
    return picked
      .map((o) => renderNode(o, ctx))
      .filter(Boolean)
      .join(", ");
  }

  // Repeat: loop count times, rendering the body (payload or child block) each time. The count is
  // scaled by intensity (round(n × intensity/100)), so the dial thins/thickens repetition.
  if (node.repeat) {
    const lo = scaleCount(node.repeat.min, ctx.intensity);
    const hi = scaleCount(node.repeat.max, ctx.intensity);
    const count = ctx.rng.int(Math.min(lo, hi), Math.max(lo, hi));
    const parts = [];
    for (let i = 0; i < count; i++) {
      let part;
      if (node.children.length) part = renderNodes(node.children, ctx);
      else part = renderInlineBody(node, ctx);
      if (part && part.trim() !== "") parts.push(part.trim());
    }
    return parts.join(", ");
  }

  // References.
  if (node.ref) return renderRef(node.ref, weightOf(node), ctx);

  // Plain gated block (`maybe:` etc. with children, no choice/repeat).
  if (node.block || (node.children.length && !node.payload)) {
    return renderNodes(node.children, ctx);
  }

  // Flow (MVP: goto/insert behave like a call+include; back is a no-op terminator).
  if (node.flow) {
    if (node.flow.kind === "goto") return ctx.section(node.flow.target);
    return "";
  }

  return renderInlineBody(node, ctx);
}

/** Render the payload text of a node, substituting inline `{js:path}` via the bridge. */
function renderInlineBody(node, ctx) {
  let t = node.payload || "";
  // Dial keyword tokens (resolved here, where the dials are known), each with an optional relative
  // modifier. The dial IS a percent, so `$intensity` / `$focus` expands to the percent itself (`50%`)
  // — there is no separate `%` form. `$intensity-word` / `$focus-word` is the natural-language word
  // (`normal`, `pure`). A trailing ` ±NN%` derives a value off the dial (`$intensity-word +25%`,
  // `$focus -10%`). The `$` sigil keeps them distinct from `{list}` syntax.
  // See notes/reference/intensity-design.md and notes/reference/focus-design.md.
  t = t.replace(
    /\$(intensity|focus)(-word)?(?:\s*([+-]\d+(?:\.\d+)?)%)?/g,
    (_m, dial, fmt, mod) => {
      const isFocus = dial === "focus";
      const v = applyIntensityMod(isFocus ? ctx.focus : ctx.intensity, mod);
      if (fmt === "-word") return isFocus ? focusWord(v) : intensityWord(v);
      return `${v}%`; // the dial is inherently a percent
    },
  );
  // Nested refs carrying dial args — `{#name i25% f80%}`, with MANDATORY `i`/`f` prefixes. Each arg may
  // be absolute (`i80%`) or relative (`i+25%`, `f-40%`); relatives derive an ABSOLUTE percent from the
  // current dial. Normalized here to absolute, prefixed args so the flat downstream resolver only ever
  // sees `{#name iNN% fNN%}`. (An unprefixed `{#name 25%}` is not dial syntax and is left untouched.)
  t = t.replace(/\{#([\w/-]+)((?:\s+[if][+-]?\d+(?:\.\d+)?%)+)\}/gi, (_m, name, args) => {
    let iVal = null;
    let fVal = null;
    const tokRe = /([if])([+-]?)(\d+(?:\.\d+)?)%/gi;
    let tm;
    while ((tm = tokRe.exec(args))) {
      const dial = tm[1].toLowerCase();
      const base = dial === "f" ? ctx.focus : ctx.intensity;
      const val = tm[2] ? applyIntensityMod(base, tm[2] + tm[3]) : clampIntensity(Number(tm[3]));
      if (dial === "f") fVal = val;
      else iVal = val;
    }
    let out = `{#${name}`;
    if (iVal != null) out += ` i${iVal}%`;
    if (fVal != null) out += ` f${fVal}%`;
    return out + "}";
  });
  // Inline JS values: {js:path}
  t = t.replace(/\{js:([^}]+)\}/g, (_m, p) => ctx.bridge?.resolveJs?.(p.trim(), ctx) ?? "");
  // A child block alongside a payload line (rare) — append.
  if (node.children.length && !node.choice && !node.repeat) {
    const sub = renderNodes(node.children, ctx);
    if (sub) t = t ? `${t}, ${sub}` : sub;
  }
  return t;
}

/** Resolve a reference node (call/insert/js-block) to a string. */
function renderRef(ref, _weight, ctx) {
  if (ref.kind === "call" || ref.kind === "insert") {
    // A DPL-side section (local) or another generator/list/expansion token (passthrough).
    if (ctx.hasSection(ref.name)) return ctx.section(ref.name);
    if (/^#/.test(ref.name)) return `{${ref.name}}`; // +#weather -> {#weather}
    return `{#${ref.name}}`; // bare name -> dynamic-prompt token, resolved downstream
  }
  if (ref.kind === "js-block") return ctx.bridge?.resolveJs?.(ref.path, ctx) ?? "";
  return "";
}

/** A node's explicit weight, or null (used for refs that carry a weight). */
function weightOf(node) {
  return node.weight ?? null;
}

/**
 * Pick `n` distinct options weighted by each option's leading gate %, else uniform. Draws from the
 * render context's rng (`ctx.rng`) so the pick is part of the seeded stream — not `Math.random`.
 * @param {Array} opts The option nodes.
 * @param {number} n How many to pick.
 * @param {{float: Function}} rng The seam's random source.
 * @returns {Array} The picked option nodes.
 */
function weightedSampleN(opts, n, rng) {
  const pool = opts.map((o) => ({ o, w: o.gate != null ? o.gate : 1 }));
  const picked = [];
  for (let k = 0; k < n && pool.length; k++) {
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = rng.float() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    picked.push(pool[Math.min(idx, pool.length - 1)].o);
    pool.splice(Math.min(idx, pool.length - 1), 1);
  }
  return picked;
}
