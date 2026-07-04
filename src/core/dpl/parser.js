/**
 * @file
 * @brief DPL parser: front-matter split, comment/indent lexing, section + indentation-tree
 * building, and per-line node parsing (weight/gate/repeat/choice/ref/payload). Produces the
 * typed node trees the renderer consumes. See notes/reference/dpl-design.md.
 */

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
  while ((cm = condRe.exec(rest))) {
    const dial = cm[1].toLowerCase();
    const cond = { op: cm[2], value: Number(cm[3]) };
    if (dial === "f") {
      if (!fCond) fCond = cond;
    } else if (!iCond) {
      iCond = cond;
    }
    rest = rest.slice(0, cm.index) + rest.slice(cm.index + cm[0].length);
  }
  rest = rest.replaceAll("|", " ").trim();
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
export function parseFrontMatter(source) {
  const meta = {};
  const lines = source.replaceAll("\r", "").split("\n");
  if (lines[0]?.trim() !== "---") return { meta, body: lines.join("\n") };
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      i++;
      break;
    }
    const m = /^\s*([\w-]+)\s*:(.*)$/.exec(lines[i]);
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
export function lexLines(body) {
  const rawLines = body.split("\n");
  let unit = null;
  const out = [];
  for (let raw of rawLines) {
    // Strip `;` comments (not inside the literal — DPL has no string literals, so simple).
    const semi = raw.indexOf(";");
    if (semi >= 0) raw = raw.slice(0, semi);
    if (raw.trim() === "") continue;
    const indentMatch = /^[ \t]*/.exec(raw)[0];
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
export function parseSections(lines) {
  const sections = {};
  let current = null;
  const ensure = (name, weightLine) => {
    if (!sections[name]) sections[name] = { name, weightLine: weightLine ?? name, lines: [] };
    return sections[name];
  };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const next = lines[i + 1];
    if (next?.depth === 0 && /^={3,}$/.test(next.text) && ln.depth === 0) {
      // name (drop a trailing weight bracket); slice at the first `[` — linear, no regex backtracking
      const bracketAt = ln.text.indexOf("[");
      current = (bracketAt >= 0 ? ln.text.slice(0, bracketAt) : ln.text).trim() || ln.text.trim();
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
      if (nodes.length) nodes.at(-1).children = sub.nodes;
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

/** Flow directive at the head of a line (`go back` / `go to X`), or null. */
function parseFlow(t) {
  if (/^go\s+back\b/i.test(t)) return { kind: "back" };
  const gotoM = t.match(/^go\s+to\s+(\S.*)$/i);
  if (gotoM) return { kind: "goto", target: gotoM[1].trim() };
  return null;
}

/**
 * Parse a leading gate (`otherwise`, `NN%`, `maybe`, `NN% chance`) onto `out`, returning the
 * remaining text. `scaleGate` marks a *probability* gate (intensity auto-scales it); a bare
 * `otherwise` keeps an unscaled gate of 1 (it runs whenever the paired gate failed).
 */
function parseGate(t, out) {
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
    out.gate = 1;
  }
  return t;
}

/**
 * Parse a `one of` / `N of` / `A to B of` choice (optional `(NN% nothing)` miss) onto `out`.
 * Returns true when a choice was recorded (the node is then complete).
 */
function parseChoice(t, out) {
  const missRe = String.raw`(?:\((\d+(?:\.\d+)?)%\s*nothing\))?\s*:?\s*$`;
  const oneOfM = t.match(new RegExp(String.raw`^one\s+of\s*${missRe}`, "i"));
  const nOfM = oneOfM
    ? null
    : t.match(new RegExp(String.raw`^(\d+)(?:\s+to\s+(\d+))?\s+of\s*${missRe}`, "i"));
  if (!(oneOfM || nOfM) || !out.children.length) return false;
  const min = oneOfM ? 1 : Number(nOfM[1]);
  let max;
  if (oneOfM) max = 1;
  else if (nOfM[2]) max = Number(nOfM[2]);
  else max = min;
  const missCap = oneOfM ? oneOfM[1] : nOfM[3];
  out.choice = { min, max, miss: missCap ? Number(missCap) / 100 : 0 };
  return true;
}

/** Parse a `repeat N times` / `repeat A to B times` prefix onto `out`, returning the remaining text. */
function parseRepeat(t, out) {
  const repeatM = t.match(/^repeat\s+(\d+)(?:\s+to\s+(\d+))?\s+times\s*:?\s*/i);
  if (!repeatM) return t;
  out.repeat = {
    min: Number(repeatM[1]),
    max: repeatM[2] ? Number(repeatM[2]) : Number(repeatM[1]),
  };
  return t.slice(repeatM[0].length);
}

/** Parse a reference form (`insert js: path` / `insert name` / `+name`) onto `out`. */
function parseRef(t, out) {
  const insertJsM = t.match(/^insert\s+js:\s*(\S+)\s*$/i);
  const insertM = t.match(/^insert\s+(\S+)\s*$/i);
  const callM = t.match(/^\+(\S+)\s*$/);
  if (insertJsM) out.ref = { kind: "js-block", path: insertJsM[1] };
  else if (insertM) out.ref = { kind: "insert", name: insertM[1] };
  else if (callM) out.ref = { kind: "call", name: callM[1] };
}

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

  // Flow (`go back` / `go to X`) — terminal.
  const flow = parseFlow(t);
  if (flow) {
    out.flow = flow;
    return out;
  }

  // Gate (NN% / maybe / NN% chance / otherwise), then choice (terminal), then repeat, then ref.
  t = parseGate(t, out);
  if (parseChoice(t, out)) return out;
  t = parseRepeat(t, out);
  parseRef(t, out);

  // A trailing ":" with children but no choice/repeat → a plain gated block.
  if (t.endsWith(":") && out.children.length && !out.ref) {
    out.block = true;
    t = t.replace(/:\s*$/, "");
  }

  out.payload = t.trim();
  return out;
}
