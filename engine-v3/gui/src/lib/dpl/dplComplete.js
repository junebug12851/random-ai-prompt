/**
 * Context-aware DPL autocomplete for the CodeMirror editor: the completion source wired to the
 * engine's building-block catalog, the option-rendering helpers (kind badge, section header, the
 * live-example info tooltip), and the front-matter / section-name context detectors. Split out of
 * dplLanguage.js, which keeps the tokenizer + highlight.
 * @module gui/lib/dpl/dplComplete
 */
import { snippetCompletion } from "@codemirror/autocomplete";
// A handful of line-leading structural completions (only offered on a `-` bullet line).
const DPL_KEYWORDS = [
  { label: "maybe ", info: "50% chance this line is included" },
  { label: "otherwise ", info: "Runs only when the previous gate failed" },
  { label: "one of", info: "Pick exactly one of the indented children" },
  { label: "repeat 2 times", info: "Repeat the body N (or A to B) times" },
  { label: "insert ", info: "Insert another list / generator by name" },
  { label: "go to ", info: "Jump to another section" },
];

// Front-matter keys offered inside the leading `---` block.
const FM_KEYS = [
  { label: "description: ", info: "One-line summary — the editor tooltip / .json sidecar." },
  { label: "suggestions: off", info: "Keep this block out of {#random} suggestions." },
  {
    label: "stacking: true",
    info: "Let this block render more than once (skip global single-layer dedup). Default: once per prompt.",
  },
  { label: "script: ", info: "Delegate the whole block to a JS file (advanced)." },
];

// The two dials, offered after a space inside `{#name …}`. Each applies a `iNN%` / `fNN%` snippet
// with the `NN` pre-selected so the user can immediately type their own percent.
const DIALS = [
  {
    key: "i",
    detail: "intensity",
    info: "intensity — how MUCH this block renders (1–100%, default 50). Higher = denser; it auto-scales the block's chances and counts.",
  },
  {
    key: "f",
    detail: "focus",
    info: "focus — how PURE / narrow the result is (1–100%, default 50). Higher keeps only the essentials (less fluff); lower lets in extra, atmospheric detail.",
  },
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// Render a section header for the grouped dropdown (CompletionSection.header). The section name
// is "Group · category" (e.g. "Blocks · scene"); we split it so the group reads as an eyebrow.
const sectionHeader = (section) => {
  const wrap = el("div", "cm-dpl-section");
  const [group, ...rest] = String(section.name).split(" · ");
  if (rest.length) {
    wrap.appendChild(el("span", "cm-dpl-section-group", group));
    wrap.appendChild(el("span", "cm-dpl-section-name", rest.join(" · ")));
  } else {
    wrap.appendChild(el("span", "cm-dpl-section-name", group));
  }
  return wrap;
};

/**
 * Per-option kind badge for `autocompletion({ addToOptions })`. Renders a small gen/list tag on
 * each row (and nothing for non-catalog options like the DPL keywords), so the kind is legible
 * at a glance without opening the info panel.
 * @param {import("@codemirror/autocomplete").Completion & {dplKind?: string}} completion
 * @returns {HTMLElement|null}
 */
export function dplKindBadge(completion) {
  const kind = completion.dplKind;
  if (!kind) return null;
  return el("span", `cm-dpl-kind cm-dpl-kind-${kind}`, kind);
}

// Build the rich, re-rolling info panel for one catalog entry. `expand(token, settings)` renders
// a concrete example; `getSettings()` reads the live settings (so SFW/NSFW gating is correct).
// Returns the CompletionInfo `{dom, destroy}` shape so the re-roll interval is cleaned up when
// the highlighted option changes.
const makeInfo = (it, expand, getSettings) => () => {
  const dom = el("div", "cm-dpl-info");

  const head = el("div", "cm-dpl-info-head");
  head.appendChild(el("span", "cm-dpl-info-title", it.token));
  head.appendChild(el("span", `cm-dpl-kind cm-dpl-kind-${it.kind}`, it.kind));
  if (it.category) head.appendChild(el("span", "cm-dpl-info-cat", it.category));
  dom.appendChild(head);

  if (it.description) dom.appendChild(el("p", "cm-dpl-info-desc", it.description));

  if (typeof expand !== "function") return dom;

  const ex = el("div", "cm-dpl-info-ex");
  ex.appendChild(el("span", "cm-dpl-info-ex-label", "Example"));
  const exText = el("span", "cm-dpl-info-ex-text");
  ex.appendChild(exText);
  dom.appendChild(ex);

  const roll = () => {
    try {
      const out = expand(it.token, getSettings ? getSettings() : {});
      exText.textContent = out && out.trim() ? out : "—";
    } catch {
      exText.textContent = "—";
    }
  };
  roll();
  const id = setInterval(roll, 1000);
  return { dom, destroy: () => clearInterval(id) };
};

/** Is `pos` inside the leading `---` … `---` front-matter block? */
export function inFrontMatter(state, pos) {
  const doc = state.doc;
  if (doc.lines < 1 || doc.line(1).text.trim() !== "---") return false;
  const cur = doc.lineAt(pos).number;
  if (cur === 1) return false; // on the opening fence itself
  for (let i = 2; i <= doc.lines; i++) {
    if (doc.line(i).text.trim() === "---") return cur < i;
  }
  return true; // front matter not yet closed
}

/** Section names declared in the doc (a text line immediately followed by an `={3,}` underline). */
function sectionNames(state) {
  const doc = state.doc;
  const out = [];
  for (let i = 1; i < doc.lines; i++) {
    const text = doc.line(i).text.trim();
    const next = doc.line(i + 1).text.trim();
    if (text && !text.startsWith(";") && /^={3,}$/.test(next)) {
      out.push(text.replace(/\s*\[.*$/, "").trim());
    }
  }
  return [...new Set(out)].filter(Boolean);
}

/**
 * Build a CodeMirror completion source from the engine's building-block catalog. It is
 * context-aware: front-matter keys inside the `---` block; the `i`/`f` dials after a space in a
 * `{#…}`; every list/generator token inside a `{`/`{#`; section names after `go to`; generator and
 * section names after `insert` / `+`; and the DPL structural keywords on a `-` bullet line.
 * @param {() => Array<{token: string, label: string, kind: string, description?: string, group?: string, category?: string}>} getItems
 *   Returns the catalog entries (called once per completion, so a refreshed catalog is picked up).
 * @param {object} [opts]
 * @param {(token: string, settings: object) => string} [opts.expand] Render a token into a concrete
 *   example for the info panel. When omitted, the example block is skipped.
 * @param {() => object} [opts.getSettings] Reads the live generation settings (for SFW/NSFW gating).
 * @returns {import("@codemirror/autocomplete").CompletionSource} The completion source.
 */
export function dplCompletionSource(getItems, opts = {}) {
  const { expand, getSettings } = opts;
  return (context) => {
    // 1. Front matter — offer keys at the key position (before any `:` on the line).
    if (inFrontMatter(context.state, context.pos)) {
      const line = context.state.doc.lineAt(context.pos);
      const before = line.text.slice(0, context.pos - line.from);
      if (before.includes(":")) return null; // value side — leave it free-form
      const word = context.matchBefore(/[\w-]*$/);
      return {
        from: word ? word.from : context.pos,
        options: FM_KEYS.map((k) => ({ label: k.label, info: k.info, type: "property" })),
        validFor: /^[\w-]*$/,
      };
    }

    // 2. Dial args — after a space inside `{#name …}` (also `{#name i50% …`). Offer i / f, skipping
    //    a dial already present. Each inserts `iNN%` / `fNN%` with the NN pre-selected to overtype.
    const dialCtx = context.matchBefore(/\{#[\w/-]+(?:\s+[if][+-]?\d{1,3}%)*\s+$/);
    if (dialCtx) {
      const present = (dialCtx.text.match(/[if][+-]?\d{1,3}%/g) || []).map((s) => s[0].toLowerCase());
      const options = DIALS.filter((d) => !present.includes(d.key)).map((d) =>
        snippetCompletion(`${d.key}\${1:50}%`, {
          label: d.key,
          detail: d.detail,
          info: d.info,
          type: "keyword",
        }),
      );
      if (!options.length) return null;
      return { from: context.pos, options };
    }

    // 3. Brace context: replace the partial `{…` with a full token.
    const brace = context.matchBefore(/\{#?[\w/-]*$/);
    if (brace) {
      const items = getItems() || [];
      // One shared section object per name (rank = first-appearance order keeps catalog order).
      const sections = new Map();
      const sectionFor = (name, rank) => {
        if (!sections.has(name)) sections.set(name, { name, rank, header: sectionHeader });
        return sections.get(name);
      };
      const options = items.map((it, i) => {
        const name = it.category && it.group ? `${it.group} · ${it.category}` : it.group || "Blocks";
        return {
          label: it.token,
          detail: it.category || undefined,
          dplKind: it.kind,
          section: sectionFor(name, i),
          info: makeInfo(it, expand, getSettings),
          type: it.kind === "gen" ? "function" : "variable",
        };
      });
      return { from: brace.from, options, validFor: /^\{#?[\w/-]*$/ };
    }

    // 4. `go to <Section>` — offer the doc's own section names.
    const gotoCtx = context.matchBefore(/^\s*(?:-\s*)?go\s+to\s+[\w /-]*$/i);
    if (gotoCtx) {
      const prefix = gotoCtx.text.match(/^\s*(?:-\s*)?go\s+to\s+/i)[0];
      const names = sectionNames(context.state);
      return {
        from: gotoCtx.from + prefix.length,
        options: names.map((n) => ({ label: n, type: "constant", info: "Jump to this section" })),
        validFor: /^[\w /-]*$/,
      };
    }

    // 5. `insert <name>` / `+name` — offer generator names (bare, no braces) + local sections.
    const insertCtx = context.matchBefore(/^\s*(?:-\s*)?insert\s+[\w/-]*$/i);
    const callCtx = context.matchBefore(/\+[\w#/-]*$/);
    if (insertCtx || callCtx) {
      const items = getItems() || [];
      const gens = items
        .filter((it) => it.kind === "gen")
        .map((it) => it.token.replace(/^\{#?/, "").replace(/\}$/, ""));
      const sects = sectionNames(context.state);
      const names = [...new Set([...sects, ...gens])];
      let from;
      if (insertCtx) {
        from = insertCtx.from + insertCtx.text.match(/^\s*(?:-\s*)?insert\s+/i)[0].length;
      } else {
        from = callCtx.from + 1; // keep the leading `+`
      }
      return {
        from,
        options: names.map((n) => ({
          label: n,
          type: "function",
          info: sects.includes(n) ? "A section in this block" : "A generator block",
        })),
        validFor: /^[\w#/-]*$/,
      };
    }

    // 6. Line-leading DPL keyword context (only on a bullet line, so prose isn't disturbed).
    const kw = context.matchBefore(/^\s*-\s+[a-z]*$/i);
    if (kw) {
      const word = context.matchBefore(/[a-z]*$/i);
      return {
        from: word ? word.from : context.pos,
        options: DPL_KEYWORDS.map((k) => ({ label: k.label, info: k.info, type: "keyword" })),
        validFor: /^[a-z]*$/i,
      };
    }
    return null;
  };
}
