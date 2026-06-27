/**
 * CodeMirror 6 language support for DPL (the Dynamic Prompt Language the prompt / negative /
 * wrapper boxes all share). A small line-oriented {@link StreamLanguage} tokenizer feeds a
 * {@link HighlightStyle} that maps each token to a CSS class (so colors live in `styles.css`
 * and follow the light/dark theme), plus a brace-aware autocomplete source wired to the
 * engine's building-block catalog.
 *
 * Highlighted tokens mirror `src/core/dpl/dpl.js`:
 *   - `{#gen}` generator refs (incl. `{#any}`, `{#scene/beach}`) and `{list}` / reserved refs
 *   - emphasis weighting `( )` `[ ]`, alternation `|`, and a `:1.2` weight
 *   - `+ref` calls and `{js:…}` inline JS
 *   - line-leading DPL structure: `===` headings, `-` bullets, `[900]` weights, `NN%` / `maybe`
 *     / `otherwise` gates, `one of` / `N of` choices, `repeat … times`, `insert` / `go to` flow
 *   - `;` comments
 *
 * Structural keywords are only recognized at the START of a line (where the grammar puts them),
 * so prose in the prompt box — "a man of war", "maybe later" — is never mis-highlighted.
 * @module gui/lib/dpl/dplLanguage
 */
import {
  StreamLanguage,
  LanguageSupport,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { Tag } from "@lezer/highlight";

// --- Custom highlight tags (one per DPL token kind) ---------------------------------------
const T = {
  gen: Tag.define(),
  list: Tag.define(),
  weight: Tag.define(),
  bullet: Tag.define(),
  gate: Tag.define(),
  keyword: Tag.define(),
  ref: Tag.define(),
  heading: Tag.define(),
  comment: Tag.define(),
};

// StreamLanguage maps the string a token returns to one of these tags.
const tokenTable = {
  gen: T.gen,
  list: T.list,
  weight: T.weight,
  bullet: T.bullet,
  gate: T.gate,
  keyword: T.keyword,
  ref: T.ref,
  heading: T.heading,
  comment: T.comment,
};

/**
 * The DPL stream tokenizer. Tracks whether the cursor is still at the logical start of a line
 * (after optional leading whitespace and a `-` bullet) so structural keywords only fire there.
 * @type {import("@codemirror/language").StreamParser<{lineStart: boolean}>}
 */
const dplParser = {
  startState: () => ({ lineStart: true }),
  token(stream, state) {
    if (stream.sol()) state.lineStart = true;
    if (stream.eatSpace()) return null;

    const atStart = state.lineStart;

    // Comment to end of line.
    if (stream.peek() === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (atStart) {
      // A heading underline (`====`) — a whole-line token.
      if (stream.match(/^={3,}\s*$/)) {
        state.lineStart = false;
        return "heading";
      }
      // A `-` bullet keeps us "at line start" so a following gate/keyword still leads.
      if (stream.match(/^-(?=\s|$)/)) return "bullet";
      // A leading explicit weight `[900]`.
      if (stream.match(/^\[\d+\]/)) {
        state.lineStart = false;
        return "weight";
      }
      // Gates: `NN%`, `NN% chance`, `maybe`, `otherwise`.
      if (stream.match(/^(?:\d+(?:\.\d+)?%(?:\s*chance)?|maybe|otherwise)\b/i)) {
        state.lineStart = false;
        return "gate";
      }
      // Choices / repeats / flow.
      if (
        stream.match(
          /^(?:one\s+of|\d+\s+to\s+\d+\s+of|\d+\s+of|repeat\s+\d+(?:\s+to\s+\d+)?\s+times|go\s+to|go\s+back|insert\s+js:|insert)\b/i,
        )
      ) {
        state.lineStart = false;
        return "keyword";
      }
    }
    state.lineStart = false;

    // `{…}` / `{#…}` / `{js:…}` references — consume through the closing brace.
    if (stream.peek() === "{") {
      stream.next();
      const gen = stream.peek() === "#";
      while (!stream.eol()) if (stream.next() === "}") break;
      return gen ? "gen" : "list";
    }
    // `+ref` call (anywhere — `\+\w` won't catch "a + b").
    if (stream.match(/^\+[\w#/-]+/)) return "ref";
    // Emphasis weighting / alternation, and a `:1.2` weight.
    if (stream.match(/^[()[\]|]/)) return "weight";
    if (stream.match(/^:\d+(?:\.\d+)?/)) return "weight";

    // Plain text: a run up to the next special character.
    if (!stream.match(/^[^{}()[\]|;:+]+/)) stream.next();
    return null;
  },
  tokenTable,
};

/** The DPL {@link StreamLanguage}. */
export const dplStreamLanguage = StreamLanguage.define(dplParser);

// --- Highlight style: tag -> CSS class (colors set in styles.css, theme-aware) ------------
const dplHighlightStyle = HighlightStyle.define([
  { tag: T.gen, class: "cm-dpl-gen" },
  { tag: T.list, class: "cm-dpl-list" },
  { tag: T.weight, class: "cm-dpl-weight" },
  { tag: T.bullet, class: "cm-dpl-bullet" },
  { tag: T.gate, class: "cm-dpl-gate" },
  { tag: T.keyword, class: "cm-dpl-keyword" },
  { tag: T.ref, class: "cm-dpl-ref" },
  { tag: T.heading, class: "cm-dpl-heading" },
  { tag: T.comment, class: "cm-dpl-comment" },
]);

/**
 * The DPL language + its (theme-aware) highlighting, ready to drop into an editor's extensions.
 * @returns {import("@codemirror/state").Extension[]} Language support + highlighting.
 */
export function dplLanguage() {
  return [new LanguageSupport(dplStreamLanguage), syntaxHighlighting(dplHighlightStyle)];
}

// A handful of line-leading structural completions (only offered on a `-` bullet line).
const DPL_KEYWORDS = [
  { label: "maybe ", info: "50% chance this line is included" },
  { label: "otherwise ", info: "Runs only when the previous gate failed" },
  { label: "one of", info: "Pick exactly one of the indented children" },
  { label: "repeat 2 times", info: "Repeat the body N (or A to B) times" },
  { label: "insert ", info: "Insert another list / generator by name" },
  { label: "go to ", info: "Jump to another section" },
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

/**
 * Build a CodeMirror completion source from the engine's building-block catalog.
 *
 * Inside a `{` / `{#` the dropdown offers every list and generator token (each option replaces
 * the partial brace, so there's no double-brace), grouped into section headers by category and
 * carrying a kind badge + a rich info panel (title, kind/category, description, a re-rolling
 * example). On a `-` bullet line it offers the DPL structural keywords instead.
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
    // Brace context: replace the partial `{…` with a full token.
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
    // Line-leading DPL keyword context (only on a bullet line, so prose isn't disturbed).
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
