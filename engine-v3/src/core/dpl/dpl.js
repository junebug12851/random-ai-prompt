/**
 * @file
 * @brief DPL (Dynamic Prompt Language) parser + weighted-layer renderer. See notes/reference/dpl-design.md.
 */

// DPL is the v3 authoring language for dynamic prompts: a Markdown-shaped, data-not-code
// description of "what to maybe say", evaluated as a tree of weighted LAYERS. A file is a
// layer; each section is a layer; each line is a layer. Weights are LOCAL sort keys
// (lower = rendered earlier) — a layer only reorders its own children and never the parent.
// `compileDpl(source, bridge)` returns the same shape as a JS generator module
// (`{ default, suggestion_exclude }`) so the existing engine/loader are untouched.
//
// Plain text is valid DPL (every line is just an always-on layer), so the prompt box and the
// generator files share one language. See notes/reference/dpl-design.md for the full spec and
// notes/plans/v3-layers.md for the engine model.

/** Default randomness (Math.random-based, matching the v2 generators' lodash usage). */
const RNG = {
  /** Inclusive integer in [a, b]. */
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  /** True with probability p (0..1). */
  chance: (p) => Math.random() < p,
  /** A uniformly random element of arr. */
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
};

const AUTO_WEIGHT_START = 1000; // first auto-assigned line weight; +1 per following line

// Intensity: a per-reference "how much" dial (1..100). Unspecified → DEFAULT_INTENSITY; 0 → 1.
// See notes/reference/intensity-design.md.
const DEFAULT_INTENSITY = 50;

// Focus: a per-reference "how pure / how narrow" dial (1..100), a SIBLING of intensity. Low focus
// admits fluff/extra/unrelated detail (a city in a cave scene, distant mountains, mood garnish); high
// focus keeps only what is strictly essential to the subject, which also makes a generator stack more
// cleanly as a global layer. Unlike intensity, focus does NOT auto-scale gates/counts — it is purely
// author-judged via `[f<NN%]` conditions and the `$focus` token (a human/AI decides, per line, what
// is fluff at what focus). See notes/reference/focus-design.md.
const DEFAULT_FOCUS = 50;

/** Normalize an intensity argument to an integer 1..100 (undefined → default, 0 → 1, >100 → 100). */
function clampIntensity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_INTENSITY;
  const r = Math.round(n);
  if (r <= 0) return 1; // "0% is assumed to be 1%"
  return r > 100 ? 100 : r;
}

/** Normalize a focus argument to an integer 1..100 (undefined → default, 0 → 1, >100 → 100). */
function clampFocus(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_FOCUS;
  const r = Math.round(n);
  if (r <= 0) return 1;
  return r > 100 ? 100 : r;
}

// A 100-step intensity word scale: one word per percent, least → most, with 50 ≈ "normal". Curated
// to size / amount / scale / proportion terms (kept the intentional "tiny" run). `$intensity-word`
// at intensity N renders INTENSITY_WORDS[N-1].
const INTENSITY_WORDS = [
  "barely-there", // 1
  "near-zero", // 2
  "negligible", // 3
  "trace", // 4
  "speck", // 5
  "fleck", // 6
  "smidge", // 7
  "pinch", // 8
  "dab", // 9
  "sliver", // 10
  "scrap", // 11
  "crumb", // 12
  "morsel", // 13
  "drop", // 14
  "sprinkle", // 15
  "spoonful", // 16
  "handful", // 17
  "palmful", // 18
  "pocketful", // 19
  "ultra-tiny", // 20
  "extra-tiny", // 21
  "very tiny", // 22
  "tiny", // 23
  "teensy", // 24
  "itty-bitty", // 25
  "minuscule", // 26
  "miniature", // 27
  "mini", // 28
  "diminutive", // 29
  "little", // 30
  "small", // 31
  "compact", // 32
  "undersized", // 33
  "pint-sized", // 34
  "scant", // 35
  "sparse", // 36
  "meager", // 37
  "skimpy", // 38
  "slight", // 39
  "thin", // 40
  "slim", // 41
  "narrow", // 42
  "short", // 43
  "reduced", // 44
  "partial", // 45
  "modest", // 46
  "moderate", // 47
  "medium", // 48
  "average", // 49
  "normal", // 50
  "full-size", // 51
  "regular", // 52
  "standard", // 53
  "noticeable", // 54
  "decent", // 55
  "respectable", // 56
  "sizable", // 57
  "ample", // 58
  "roomy", // 59
  "generous", // 60
  "broad", // 61
  "wide", // 62
  "large", // 63
  "big", // 64
  "hefty", // 65
  "bulky", // 66
  "oversized", // 67
  "substantial", // 68
  "considerable", // 69
  "abundant", // 70
  "plentiful", // 71
  "copious", // 72
  "overflowing", // 73
  "packed", // 74
  "crowded", // 75
  "expansive", // 76
  "extensive", // 77
  "sweeping", // 78
  "great", // 79
  "major", // 80
  "giant", // 81
  "jumbo", // 82
  "huge", // 83
  "enormous", // 84
  "immense", // 85
  "massive", // 86
  "gigantic", // 87
  "tremendous", // 88
  "colossal", // 89
  "mammoth", // 90
  "titanic", // 91
  "monumental", // 92
  "vast", // 93
  "towering", // 94
  "gargantuan", // 95
  "humongous", // 96
  "mega", // 97
  "immeasurable", // 98
  "limitless", // 99
  "beyond measure", // 100
];

/** The natural-language word for an intensity percent 1..100 (the `$intensity-word` token). */
export function intensityWord(p) {
  const i = Math.min(100, Math.max(1, Math.round(p)));
  return INTENSITY_WORDS[i - 1];
}

// A 100-step focus word scale: one word per percent on the RELEVANCE axis — how much non-topic detail
// is allowed. 1 = anything loosely touching the topic may appear; 50 ≈ normal on-topic; 100 = only the
// exact subject, nothing else. `$focus-word` at focus N renders FOCUS_WORDS[N-1].
const FOCUS_WORDS = [
  "anything-goes", // 1
  "unbounded", // 2
  "unrestricted", // 3
  "unlimited", // 4
  "freeform", // 5
  "open-ended", // 6
  "loose", // 7
  "lax", // 8
  "permissive", // 9
  "lenient", // 10
  "relaxed", // 11
  "forgiving", // 12
  "tolerant", // 13
  "generous", // 14
  "allowing", // 15
  "broad", // 16
  "general", // 17
  "wide-scope", // 18
  "full-range", // 19
  "far-reaching", // 20
  "low-filter", // 21
  "high-leeway", // 22
  "loose-fit", // 23
  "low-precision", // 24
  "low-adherence", // 25
  "indirect", // 26
  "remote", // 27
  "distant", // 28
  "faintly-related", // 29
  "vaguely-related", // 30
  "loosely-related", // 31
  "side-detail", // 32
  "background-detail", // 33
  "outer-detail", // 34
  "extra-detail", // 35
  "fringe-detail", // 36
  "edge-detail", // 37
  "nearby-detail", // 38
  "related-detail", // 39
  "peripheral", // 40
  "tangential", // 41
  "adjacent", // 42
  "connected", // 43
  "related", // 44
  "relevant", // 45
  "applicable", // 46
  "suitable", // 47
  "balanced", // 48
  "moderate", // 49
  "normal", // 50
  "appropriate", // 51
  "pertinent", // 52
  "germane", // 53
  "on-subject", // 54
  "on-topic", // 55
  "in-scope", // 56
  "within-bounds", // 57
  "subject-bound", // 58
  "topic-bound", // 59
  "bounded", // 60
  "contained", // 61
  "limited", // 62
  "restricted", // 63
  "constrained", // 64
  "filtered", // 65
  "selective", // 66
  "relevant-only", // 67
  "topic-centered", // 68
  "subject-centered", // 69
  "direct", // 70
  "specific", // 71
  "particular", // 72
  "defined", // 73
  "explicit", // 74
  "literal", // 75
  "close-fit", // 76
  "tight-fit", // 77
  "narrow", // 78
  "exact", // 79
  "accurate", // 80
  "precise", // 81
  "clean", // 82
  "uncluttered", // 83
  "spare", // 84
  "minimal", // 85
  "trimmed", // 86
  "pared-down", // 87
  "bare", // 88
  "strict", // 89
  "rigorous", // 90
  "stringent", // 91
  "restrictive", // 92
  "exacting", // 93
  "exclusive", // 94
  "isolated", // 95
  "singular", // 96
  "single-subject", // 97
  "pure", // 98
  "absolute", // 99
  "topic-only", // 100
];

/** The natural-language word for a focus percent 1..100 (the `$focus-word` token); loose → topic-only. */
function focusWord(p) {
  const i = Math.min(100, Math.max(1, Math.round(p)));
  return FOCUS_WORDS[i - 1];
}

/** Scale an authored count by intensity: round(n × intensity/100), never below 0. */
function scaleCount(n, intensity) {
  return Math.max(0, Math.round(n * (intensity / 100)));
}

/**
 * Apply a relative modifier to an intensity, clamped to 1..100. A signed percent is taken *of the
 * value* — `+25` → ×1.25, `-25` → ×0.75 ("25% more/less of the intensity"). `null`/`""` → unchanged.
 */
function applyIntensityMod(base, mod) {
  if (mod == null || mod === "") return clampIntensity(base);
  const p = Number(mod);
  if (!Number.isFinite(p)) return clampIntensity(base);
  return clampIntensity(base * (1 + p / 100));
}

/** Evaluate a dial condition (`{op, value}`) against the current dial value (intensity or focus). */
function condPasses(cond, value) {
  switch (cond.op) {
    case "<":
      return value < cond.value;
    case "<=":
      return value <= cond.value;
    case ">":
      return value > cond.value;
    case ">=":
      return value >= cond.value;
    case "=":
    case "==":
      return value === cond.value;
    case "!=":
      return value !== cond.value;
    default:
      return true;
  }
}

/**
 * Parse the inside of a leading `[…]` bracket into `{ weight?, iCond?, fCond? }`, or null when it is
 * not a weight/condition spec (so `[[castle]]`, `[deemph]`, `[a:b:0.5]`, the salt literal pass through
 * as payload). A weight is bare digits; a condition is `[if] OP NN%` — the dial prefix `i` (intensity)
 * or `f` (focus) is MANDATORY (the two look-alike percents must be disambiguated; an unprefixed
 * `OP NN%` is not a condition and leaves the bracket as payload). A bracket may stack a weight and one
 * i-condition and one f-condition, separated by a pipe or whitespace, in any order:
 * `[100 i<10% f<40%]`, `[f<40%|100]`.
 */
function parseBracketSpec(inner) {
  let rest = String(inner).trim();
  if (rest === "") return null;
  let weight = null;
  let iCond = null;
  let fCond = null;
  // A condition: a MANDATORY dial prefix (i/f), an operator, a percent. Pull each out until none remain.
  const condRe = /([if])\s*(<=|>=|==|!=|<|>|=)\s*(\d+(?:\.\d+)?)\s*%/i;
  let cm;
  while ((cm = rest.match(condRe))) {
    const dial = cm[1].toLowerCase();
    const cond = { op: cm[2], value: Number(cm[3]) };
    if (dial === "f") {
      if (!fCond) fCond = cond;
    } else if (!iCond) {
      iCond = cond;
    }
    rest = rest.slice(0, cm.index) + rest.slice(cm.index + cm[0].length);
  }
  rest = rest.replace(/\|/g, " ").trim();
  if (rest !== "") {
    if (/^\d+$/.test(rest)) weight = Number(rest);
    else return null; // leftover junk → not a valid spec; leave the bracket as payload
  }
  if (weight == null && !iCond && !fCond) return null;
  return { weight, iCond, fCond };
}

/** Consume a leading `[weight|cond…]` bracket from `t`, recording onto `out`; no-op if not a spec. */
function consumeBracket(t, out) {
  const m = t.match(/^\[([^\]]*)\]\s*/);
  if (!m) return t;
  const spec = parseBracketSpec(m[1]);
  if (!spec) return t; // [[castle]], [deemph], [a:b:0.5], … stay in the payload
  if (spec.weight != null && out.weight == null) out.weight = spec.weight;
  if (spec.iCond && !out.iCond) out.iCond = spec.iCond;
  if (spec.fCond && !out.fCond) out.fCond = spec.fCond;
  return t.slice(m[0].length);
}

// ---------------------------------------------------------------------------
// Front-matter
// ---------------------------------------------------------------------------

/**
 * Split a leading `---` YAML-ish front-matter block from the body.
 * @param {string} source The raw `.dpl` text.
 * @returns {{meta: object, body: string}} Parsed key/value meta and the remaining body.
 */
function parseFrontMatter(source) {
  const meta = {};
  const lines = source.replace(/\r/g, "").split("\n");
  if (lines[0]?.trim() !== "---") return { meta, body: lines.join("\n") };
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      i++;
      break;
    }
    const m = lines[i].match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  return { meta, body: lines.slice(i).join("\n") };
}

// ---------------------------------------------------------------------------
// Lexing: strip comments, detect the indent unit, compute each line's depth
// ---------------------------------------------------------------------------

/**
 * Turn the body into indentation-tagged raw lines. The indent unit is the first indented
 * line's leading whitespace (tab or N spaces), per the spec; depth = indent / unit.
 * @param {string} body The DPL body (front-matter removed).
 * @returns {Array<{depth: number, text: string, raw: string}>} Non-blank logical lines.
 */
function lexLines(body) {
  const rawLines = body.split("\n");
  let unit = null;
  const out = [];
  for (let raw of rawLines) {
    // Strip `;` comments (not inside the literal — DPL has no string literals, so simple).
    const semi = raw.indexOf(";");
    if (semi >= 0) raw = raw.slice(0, semi);
    if (raw.trim() === "") continue;
    const indentMatch = raw.match(/^[ \t]*/)[0];
    if (indentMatch.length > 0 && unit === null) unit = indentMatch; // first indent sets the unit
    let depth = 0;
    if (indentMatch.length > 0 && unit) depth = Math.round(indentMatch.length / unit.length);
    out.push({ depth, text: raw.trim(), raw });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing: sections (heading + `===` underline ≥3), then a tree by indentation
// ---------------------------------------------------------------------------

/**
 * Parse the lexed lines into `{ sectionName: nodeTree }`. A heading is a text line whose
 * next line is `={3,}`; `Start` is the entry section. Lines under a heading nest by depth.
 * @param {Array} lines Lexed lines from {@link lexLines}.
 * @returns {object} Map of section name -> array of child nodes.
 */
function parseSections(lines) {
  const sections = {};
  let current = null;
  const ensure = (name, weightLine) => {
    if (!sections[name]) sections[name] = { name, weightLine: weightLine ?? name, lines: [] };
    return sections[name];
  };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const next = lines[i + 1];
    if (next && next.depth === 0 && /^={3,}$/.test(next.text) && ln.depth === 0) {
      current = ln.text.replace(/\s*\[.*$/, "").trim() || ln.text.trim(); // name (drop a trailing weight)
      ensure(current, ln.text);
      i++; // consume the underline
      continue;
    }
    // Content before any heading is the implicit `Start` section — so a `.dpl` that is just a line
    // (or a few lines) of content "just works" without writing `Start\n===`. An explicit `Start`
    // heading later simply appends to the same section.
    if (current === null) ensure("Start").lines.push(ln);
    else sections[current].lines.push(ln);
  }
  // Build a nested tree for each section from its flat (depth-tagged) lines.
  const trees = {};
  for (const name of Object.keys(sections)) {
    trees[name] = buildTree(sections[name].lines, 0).nodes.map(parseNode);
  }
  return trees;
}

/**
 * Recursively group depth-tagged lines into `{ line, children }` nodes.
 * @param {Array} lines The (remaining) lexed lines.
 * @param {number} depth The depth level being collected.
 * @param {number} [start] Index to start from.
 * @returns {{nodes: Array, next: number}} Nodes at this depth and the next index.
 */
function buildTree(lines, depth, start = 0) {
  const nodes = [];
  let i = start;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.depth < depth) break;
    if (ln.depth > depth) {
      // Children belong to the previous node.
      const sub = buildTree(lines, ln.depth, i);
      if (nodes.length) nodes[nodes.length - 1].children = sub.nodes;
      i = sub.next;
      continue;
    }
    nodes.push({ line: ln, children: [] });
    i++;
  }
  return { nodes, next: i };
}

// ---------------------------------------------------------------------------
// Per-line parsing: weight, gate, repeat, choice, refs, flow, payload
// ---------------------------------------------------------------------------

/**
 * Parse one tree node's text into a typed descriptor (weight/gate/repeat/choice/ref/payload).
 * @param {{line: object, children: Array}} node A raw tree node.
 * @returns {object} The typed node (with parsed `children`).
 */
function parseNode(node) {
  let t = node.line.text;
  const out = { children: (node.children || []).map(parseNode) };

  // Optional [weight|cond] bracket BEFORE the bullet dash (`[<10%] - grass`).
  t = consumeBracket(t, out);

  // Bullet vs plain.
  out.bullet = /^-\s+/.test(t) || t === "-";
  if (out.bullet) t = t.replace(/^-\s*/, "");

  // Optional [weight|cond] bracket AFTER the bullet (`- [900] …`, `- [100|<10%] …`). Either position
  // works; the bracket carries a local weight and/or an intensity condition (see parseBracketSpec).
  t = consumeBracket(t, out);

  // Flow: go to / go back
  if (/^go\s+back\b/i.test(t)) {
    out.flow = { kind: "back" };
    return out;
  }
  const gotoM = t.match(/^go\s+to\s+(.+)$/i);
  if (gotoM) {
    out.flow = { kind: "goto", target: gotoM[1].trim() };
    return out;
  }

  // Gate: NN% / maybe / NN% chance / otherwise [gate]
  const otherwiseM = t.match(/^otherwise\b\s*/i);
  if (otherwiseM) {
    out.otherwise = true;
    t = t.slice(otherwiseM[0].length);
  }
  const maybeM = t.match(/^maybe\s*:?\s*/i);
  const pctChanceM = t.match(/^(\d+(?:\.\d+)?)%\s*chance\s*:?\s*/i);
  const pctM = t.match(/^(\d+(?:\.\d+)?)%\s+/);
  // `scaleGate` marks a *probability* gate (so intensity auto-scales it). A bare `otherwise` keeps an
  // unscaled gate of 1 (it runs whenever the paired gate failed); `otherwise NN% chance` is a real
  // probability and is scaled.
  if (pctChanceM) {
    out.gate = Number(pctChanceM[1]) / 100;
    out.scaleGate = true;
    t = t.slice(pctChanceM[0].length);
  } else if (maybeM) {
    out.gate = 0.5;
    out.scaleGate = true;
    t = t.slice(maybeM[0].length);
  } else if (pctM) {
    out.gate = Number(pctM[1]) / 100;
    out.scaleGate = true;
    t = t.slice(pctM[0].length);
  } else if (out.otherwise) {
    out.gate = 1; // bare "otherwise" always runs when the prior gate failed (not scaled)
  }

  // Choice: "one of" (singular keyword) or "N of" / "A to B of" with digit counts.
  // Optional "(NN% nothing)" miss chance.
  const missRe = "(?:\\((\\d+(?:\\.\\d+)?)%\\s*nothing\\))?\\s*:?\\s*$";
  const oneOfM = t.match(new RegExp(`^one\\s+of\\s*${missRe}`, "i"));
  const nOfM = oneOfM
    ? null
    : t.match(new RegExp(`^(\\d+)(?:\\s+to\\s+(\\d+))?\\s+of\\s*${missRe}`, "i"));
  if ((oneOfM || nOfM) && out.children.length) {
    const min = oneOfM ? 1 : Number(nOfM[1]);
    const max = oneOfM ? 1 : nOfM[2] ? Number(nOfM[2]) : min;
    const missCap = oneOfM ? oneOfM[1] : nOfM[3];
    out.choice = { min, max, miss: missCap ? Number(missCap) / 100 : 0 };
    return out;
  }

  // Repeat: repeat N times / repeat A to B times  (then ": payload" or a child block)
  const repeatM = t.match(/^repeat\s+(\d+)(?:\s+to\s+(\d+))?\s+times\s*:?\s*/i);
  if (repeatM) {
    out.repeat = {
      min: Number(repeatM[1]),
      max: repeatM[2] ? Number(repeatM[2]) : Number(repeatM[1]),
    };
    t = t.slice(repeatM[0].length);
  }

  // Reference: insert js: path | insert name | +name
  const insertJsM = t.match(/^insert\s+js:\s*(\S+)\s*$/i);
  const insertM = t.match(/^insert\s+(\S+)\s*$/i);
  const callM = t.match(/^\+(\S+)\s*$/);
  if (insertJsM) out.ref = { kind: "js-block", path: insertJsM[1] };
  else if (insertM) out.ref = { kind: "insert", name: insertM[1] };
  else if (callM) out.ref = { kind: "call", name: callM[1] };

  // A trailing ":" with children but no choice/repeat → a plain gated block.
  if (/:$/.test(t) && out.children.length && !out.ref) {
    out.block = true;
    t = t.replace(/:\s*$/, "");
  }

  out.payload = t.trim();
  return out;
}

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
function renderNodes(nodes, ctx) {
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
    const picked = weightedSampleN(opts, count);
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

/** Pick `n` distinct options weighted by each option's leading gate %, else uniform. */
function weightedSampleN(opts, n) {
  const pool = opts.map((o) => ({ o, w: o.gate != null ? o.gate : 1 }));
  const picked = [];
  for (let k = 0; k < n && pool.length; k++) {
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
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

// ---------------------------------------------------------------------------
// Compile: source -> { default, suggestion_exclude }
// ---------------------------------------------------------------------------

/**
 * Compile a `.dpl` source into a dynamic-prompt module object (same shape as a JS generator).
 * @param {string} source The `.dpl` file text.
 * @param {object} [bridge] Optional JS bridge: `{ resolveJs(path, ctx) }` for `{js:}` / `insert js:` / `script`.
 * @returns {{default: Function, suggestion_exclude: boolean, stacking: boolean, meta: object}} The module.
 */
export function compileDpl(source, bridge = null) {
  const { meta, body } = parseFrontMatter(source);
  const sections = parseSections(lexLines(body));
  const suggestion_exclude = meta.suggestions === "off" || meta.suggestions === "false";
  // A `stacking` (alias `multi`) generator opts OUT of global single-layer dedup: it may be imported
  // and rendered more than once (the many decorative fragments that garnish several clauses). Default
  // is singular — see notes/reference/layering-design.md.
  const stacking =
    meta.stacking === "true" ||
    meta.stacking === true ||
    meta.multi === "true" ||
    meta.multi === true;

  function makeCtx(settings, imageSettings, upscaleSettings, intensity, focus) {
    const ctx = {
      settings,
      imageSettings,
      upscaleSettings,
      intensity: clampIntensity(intensity),
      focus: clampFocus(focus),
      rng: RNG,
      bridge,
      hasSection: (name) => Object.prototype.hasOwnProperty.call(sections, name),
      section: (name) => (sections[name] ? renderNodes(sections[name], ctx) : ""),
      // JS->DPL bridge calls (return rendered strings).
      prompt: (name) => bridge?.runPrompt?.(name, ctx) ?? `{#${String(name).replace(/^#/, "")}}`,
      list: (name) => bridge?.runList?.(name, ctx) ?? `{${name}}`,
      expand: (snippet) => bridge?.expand?.(snippet, ctx) ?? snippet,
    };
    return ctx;
  }

  function defaultFn(settings = {}, imageSettings = {}, upscaleSettings = {}, intensity, focus) {
    const ctx = makeCtx(settings, imageSettings, upscaleSettings, intensity, focus);
    if (meta.script) return bridge?.resolveJs?.(meta.script, ctx) ?? "";
    return ctx.section("Start");
  }

  // `Auto Begin` / `Auto End`: optional sections a block can declare to contribute framing that the
  // app folds into the START / END of the whole prompt (alongside the user wrapper). They render
  // exactly like any section (probability, refs, JS), but are NOT part of the block's own `Start`
  // body. See notes/plans/v3-layers.md.
  const has = (name) => Object.prototype.hasOwnProperty.call(sections, name);
  const renderSection =
    (name) =>
    (settings = {}, imageSettings = {}, upscaleSettings = {}, intensity, focus) => {
      if (!has(name)) return "";
      return makeCtx(settings, imageSettings, upscaleSettings, intensity, focus).section(name);
    };

  return {
    default: defaultFn,
    suggestion_exclude,
    stacking,
    meta,
    hasAutoBegin: has("Auto Begin"),
    hasAutoEnd: has("Auto End"),
    autoBegin: renderSection("Auto Begin"),
    autoEnd: renderSection("Auto End"),
  };
}

export default compileDpl;
