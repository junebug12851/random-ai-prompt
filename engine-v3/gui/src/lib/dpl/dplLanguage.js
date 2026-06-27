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

/**
 * Build a CodeMirror completion source from the engine's building-block catalog.
 *
 * Inside a `{` / `{#` the dropdown offers every list and generator token (each option replaces
 * the partial brace, so there's no double-brace); on a `-` bullet line it offers the DPL
 * structural keywords.
 * @param {() => Array<{token: string, label: string, kind: string, description?: string}>} getItems
 *   Returns the catalog entries (called once per completion, so a refreshed catalog is picked up).
 * @returns {import("@codemirror/autocomplete").CompletionSource} The completion source.
 */
export function dplCompletionSource(getItems) {
  return (context) => {
    // Brace context: replace the partial `{…` with a full token.
    const brace = context.matchBefore(/\{#?[\w/-]*$/);
    if (brace) {
      const items = getItems() || [];
      const options = items.map((it) => ({
        label: it.token,
        detail: it.kind,
        info: it.description || undefined,
        type: it.kind === "gen" ? "function" : "variable",
      }));
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
