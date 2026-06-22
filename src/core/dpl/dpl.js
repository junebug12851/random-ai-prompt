/**
 * @file
 * @brief DPL (Dynamic Prompt Language) parser + weighted-layer renderer. See notes/reference/dpl-design.md.
 */

// DPL is the v3 authoring language for dynamic prompts: a Markdown-shaped, data-not-code
// description of "what to maybe say", evaluated as a tree of weighted LAYERS. A file is a
// layer; each section is a layer; each line is a layer. Weights are LOCAL sort keys
// (lower = rendered earlier) — a layer only reorders its own children and never the parent.
// `compileDpl(source, bridge)` returns the same shape as a JS generator module
// (`{ default, full, suggestion_exclude }`) so the existing engine/loader are untouched.
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

  // Bullet vs plain.
  out.bullet = /^-\s+/.test(t) || t === "-";
  if (out.bullet) t = t.replace(/^-\s*/, "");

  // Leading weight: [900]
  const wm = t.match(/^\[(\d+)\]\s*/);
  if (wm) {
    out.weight = Number(wm[1]);
    t = t.slice(wm[0].length);
  }

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
  if (pctChanceM) {
    out.gate = Number(pctChanceM[1]) / 100;
    t = t.slice(pctChanceM[0].length);
  } else if (maybeM) {
    out.gate = 0.5;
    t = t.slice(maybeM[0].length);
  } else if (pctM) {
    out.gate = Number(pctM[1]) / 100;
    t = t.slice(pctM[0].length);
  } else if (out.otherwise) {
    out.gate = 1; // bare "otherwise" always runs when the prior gate failed
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

    // Effective gate: an explicit gate (NN%/maybe/NN% chance/otherwise) always wins. A bare
    // *simple-clause* bullet (plain text / token / ref) defaults to 50%. Structural bullets
    // (one of / repeat / block) and plain (non-bullet) lines are unconditional. `gateBearing`
    // (an authored gate, not the default) is what an `otherwise` pairs against.
    const gateBearing = node.gate != null || node.otherwise === true;
    let gate = node.gate;
    if (gate == null && !node.otherwise) {
      const structural = node.choice || node.repeat || node.flow || node.block;
      if (node.bullet && !structural) gate = 0.5;
    }
    let run = true;
    if (node.otherwise) run = prevGateFailed;
    if (run && gate != null) run = ctx.rng.chance(gate);
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
  // Choice: pick 1..N options (weighted by each option's leading %), honoring a miss chance.
  if (node.choice) {
    if (node.choice.miss && ctx.rng.chance(node.choice.miss)) return "";
    const opts = node.children.slice();
    if (!opts.length) return "";
    const count = ctx.rng.int(node.choice.min, Math.min(node.choice.max, opts.length));
    const picked = weightedSampleN(opts, count);
    return picked
      .map((o) => renderNode(o, ctx))
      .filter(Boolean)
      .join(", ");
  }

  // Repeat: loop count times, rendering the body (payload or child block) each time.
  if (node.repeat) {
    const count = ctx.rng.int(node.repeat.min, node.repeat.max);
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
// Compile: source -> { default, full, suggestion_exclude }
// ---------------------------------------------------------------------------

/**
 * Compile a `.dpl` source into a dynamic-prompt module object (same shape as a JS generator).
 * @param {string} source The `.dpl` file text.
 * @param {object} [bridge] Optional JS bridge: `{ resolveJs(path, ctx) }` for `{js:}` / `insert js:` / `script`.
 * @returns {{default: Function, full: boolean, suggestion_exclude: boolean, meta: object}} The module.
 */
export function compileDpl(source, bridge = null) {
  const { meta, body } = parseFrontMatter(source);
  const sections = parseSections(lexLines(body));
  const full = meta.type === "full";
  const suggestion_exclude = meta.suggestions === "off" || meta.suggestions === "false";

  function makeCtx(settings, imageSettings, upscaleSettings) {
    const ctx = {
      settings,
      imageSettings,
      upscaleSettings,
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

  function defaultFn(settings = {}, imageSettings = {}, upscaleSettings = {}) {
    const ctx = makeCtx(settings, imageSettings, upscaleSettings);
    if (meta.script) return bridge?.resolveJs?.(meta.script, ctx) ?? "";
    return ctx.section("Start");
  }

  // `Auto Begin` / `Auto End`: optional sections a block can declare to contribute framing that the
  // app folds into the START / END of the whole prompt (alongside the user wrapper). They render
  // exactly like any section (probability, refs, JS), but are NOT part of the block's own `Start`
  // body. See notes/plans/v3-layers.md.
  const has = (name) => Object.prototype.hasOwnProperty.call(sections, name);
  const renderSection = (name) => (settings = {}, imageSettings = {}, upscaleSettings = {}) => {
    if (!has(name)) return "";
    return makeCtx(settings, imageSettings, upscaleSettings).section(name);
  };

  return {
    default: defaultFn,
    full,
    suggestion_exclude,
    meta,
    hasAutoBegin: has("Auto Begin"),
    hasAutoEnd: has("Auto End"),
    autoBegin: renderSection("Auto Begin"),
    autoEnd: renderSection("Auto End"),
  };
}

export default compileDpl;
