/**
 * CodeMirror 6 language support for DPL (the Dynamic Prompt Language the prompt / negative /
 * wrapper boxes and the Manage block editor all share). A small line-oriented {@link StreamLanguage}
 * tokenizer feeds a {@link HighlightStyle} that maps each token to a CSS class (so colors live in
 * `styles.css` and follow the light/dark theme), plus a context-aware autocomplete source wired to
 * the engine's building-block catalog.
 *
 * Highlighted tokens mirror `src/core/dpl/dpl.js`:
 *   - front matter — the leading `---` fences, `key:` names, and their values
 *   - `{#gen}` generator refs (incl. `{#any}`, `{#scene/beach}`) and `{list}` / reserved refs
 *   - the two dials — `i25%` / `f80%` args inside `{#…}`, `[i<10%]` / `[f<40%]` conditions, and the
 *     `$intensity` / `$focus` (and `-word`) keyword tokens
 *   - emphasis weighting `( )` `[ ]`, alternation `|`, and a `:1.2` weight
 *   - `+call`, `insert <name>`, `go to <Section>` (the keyword AND its name target), `{js:…}`
 *   - line-leading DPL structure: `===` headings, `-` bullets, `[900]` weights, `NN%` / `maybe`
 *     / `otherwise` gates, `one of` / `N of` choices, `repeat … times`, flow
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
import { ViewPlugin, Decoration } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { Tag } from "@lezer/highlight";

// --- Custom highlight tags (one per DPL token kind) ---------------------------------------
const T = {
  gen: Tag.define(),
  list: Tag.define(),
  dial: Tag.define(),
  weight: Tag.define(),
  bullet: Tag.define(),
  gate: Tag.define(),
  keyword: Tag.define(),
  ref: Tag.define(),
  heading: Tag.define(),
  comment: Tag.define(),
  fmDelim: Tag.define(),
  fmKey: Tag.define(),
  fmVal: Tag.define(),
};

// StreamLanguage maps the string a token returns to one of these tags.
const tokenTable = {
  gen: T.gen,
  list: T.list,
  dial: T.dial,
  weight: T.weight,
  bullet: T.bullet,
  gate: T.gate,
  keyword: T.keyword,
  ref: T.ref,
  heading: T.heading,
  comment: T.comment,
  fmDelim: T.fmDelim,
  fmKey: T.fmKey,
  fmVal: T.fmVal,
};

/**
 * The DPL stream tokenizer. Tracks line-start (so structural keywords only fire there), whether we
 * are inside a `{#…}` reference (so dial args color distinctly), whether the next token is a flow
 * NAME target (`go to`/`insert`), and the leading front-matter block.
 * @type {import("@codemirror/language").StreamParser<{lineStart: boolean, inBrace: boolean, expectName: boolean, fm: string}>}
 */
const dplParser = {
  startState: () => ({ lineStart: true, inBrace: false, expectName: false, fm: "pre" }),
  token(stream, state) {
    if (stream.sol()) {
      state.lineStart = true;
      state.inBrace = false;
      state.expectName = false;
    }

    // --- Front matter: only when the file's very first line is `---` ---
    if (state.fm === "pre") {
      if (stream.match(/^---\s*$/)) {
        state.fm = "in";
        return "fmDelim";
      }
      state.fm = "done";
    } else if (state.fm === "in") {
      if (stream.sol() && stream.match(/^---\s*$/)) {
        state.fm = "done";
        return "fmDelim";
      }
      if (stream.eatSpace()) return null;
      if (stream.peek() === ";") {
        stream.skipToEnd();
        return "comment";
      }
      if (state.lineStart && stream.match(/^[\w-]+\s*:/)) {
        state.lineStart = false;
        return "fmKey";
      }
      state.lineStart = false;
      stream.skipToEnd();
      return "fmVal";
    }

    if (stream.eatSpace()) return null;

    // The NAME target of a `go to` / `insert` (the keyword was emitted on the previous token).
    if (state.expectName) {
      state.expectName = false;
      if (stream.match(/^[^;]+/)) return "ref";
      return null;
    }

    // Inside a `{#…}` reference: color the `i25%` / `f80%` dial args, then the closing brace.
    if (state.inBrace) {
      if (stream.match(/^[if][+-]?\d{0,3}%?/i)) return "dial";
      if (stream.eat("}")) {
        state.inBrace = false;
        return "gen";
      }
      stream.next(); // stray char inside the ref — keep it gen-colored
      return "gen";
    }

    const atStart = state.lineStart;

    // Comment to end of line.
    if (stream.peek() === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (atStart) {
      // (Section heading NAMES need to see the NEXT line — a stream tokenizer can't — so they are
      // colored by the `sectionHighlighter` view plugin below, not here.)
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
      // A leading COMBINED weight/condition spec bracket — `[100 i<10% f<40%]`, `[f<40%|100]`. The
      // pure-weight `[900]` is already consumed above; anything else here mixes a weight and/or the
      // `i`/`f` dial conditions, so color the whole bracket as a dial. (`[[castle]]` / `[deemph]` /
      // `[a:b:0.5]` don't match — their inner text isn't a digit or an `i`/`f` condition — so they
      // fall through and stay payload, exactly as the engine parser treats them.)
      if (
        stream.match(
          /^\[\s*(?:\d+|[if]\s*(?:<=|>=|==|!=|<|>|=)\s*\d+(?:\.\d+)?%)(?:[\s|]+(?:\d+|[if]\s*(?:<=|>=|==|!=|<|>|=)\s*\d+(?:\.\d+)?%))*\s*\]/i,
        )
      ) {
        state.lineStart = false;
        return "dial";
      }
      // Gates: an optional leading `otherwise`, then `NN%` / `NN% chance` / `maybe`. Coloring the
      // `otherwise NN%` / `otherwise maybe` pair as ONE gate token matches the parser (which reads
      // `otherwise` then a second scaling gate on the same line).
      if (
        stream.match(/^otherwise\b(?:\s+(?:\d+(?:\.\d+)?%\s*chance|\d+(?:\.\d+)?%|maybe\b))?/i)
      ) {
        state.lineStart = false;
        return "gate";
      }
      if (stream.match(/^(?:\d+(?:\.\d+)?%(?:\s*chance)?|maybe)\b/i)) {
        state.lineStart = false;
        return "gate";
      }
      // `insert js:` — the keyword, then its JS path colored as a ref (via expectName).
      if (stream.match(/^insert\s+js:/i)) {
        state.lineStart = false;
        state.expectName = true;
        return "keyword";
      }
      // `go to` / `insert` — these take a NAME target we color next.
      if (stream.match(/^(?:go\s+to|insert)(?=\s)/i)) {
        state.lineStart = false;
        state.expectName = true;
        return "keyword";
      }
      // Choices: `one of` / `N of` / `A to B of`, with an optional `(NN% nothing)` miss cap.
      if (
        stream.match(
          /^(?:one\s+of|\d+\s+to\s+\d+\s+of|\d+\s+of)(?:\s*\(\s*\d+(?:\.\d+)?%\s*nothing\s*\))?/i,
        )
      ) {
        state.lineStart = false;
        return "keyword";
      }
      // Repeats / the rest of flow (no name target).
      if (stream.match(/^(?:repeat\s+\d+(?:\s+to\s+\d+)?\s+times|go\s+back|branch)\b/i)) {
        state.lineStart = false;
        return "keyword";
      }
    }
    state.lineStart = false;

    // `$intensity` / `$focus` keyword tokens (with optional `-word` and a ` ±NN%` modifier).
    if (stream.match(/^\$(?:intensity|focus)(?:-word)?(?:\s*[+-]\d+(?:\.\d+)?%)?/)) return "dial";

    // `{…}` / `{#…}` / `{js:…}` references. A `{#…}` opens "brace mode" so its dial args color apart.
    if (stream.peek() === "{") {
      stream.next();
      if (stream.peek() === "#") {
        stream.next();
        stream.match(/^[\w/-]+/); // the generator name (dials, if any, follow in brace mode)
        state.inBrace = true;
        return "gen";
      }
      while (!stream.eol()) if (stream.next() === "}") break;
      return "list";
    }
    // A standalone `[i<10%]` / `[f<40%]` dial condition.
    if (stream.match(/^\[\s*[if]\s*(?:<=|>=|==|!=|<|>|=)\s*\d+(?:\.\d+)?%\s*\]/i)) return "dial";
    // `+ref` call (anywhere — `\+\w` won't catch "a + b").
    if (stream.match(/^\+[\w#/-]+/)) return "ref";
    // Emphasis weighting / alternation, and a `:1.2` weight.
    if (stream.match(/^[()[\]|]/)) return "weight";
    if (stream.match(/^:\d+(?:\.\d+)?/)) return "weight";

    // Plain text: a run up to the next special character.
    if (!stream.match(/^[^{}()[\]|;:+$]+/)) stream.next();
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
  { tag: T.dial, class: "cm-dpl-dial" },
  { tag: T.weight, class: "cm-dpl-weight" },
  { tag: T.bullet, class: "cm-dpl-bullet" },
  { tag: T.gate, class: "cm-dpl-gate" },
  { tag: T.keyword, class: "cm-dpl-keyword" },
  { tag: T.ref, class: "cm-dpl-ref" },
  { tag: T.heading, class: "cm-dpl-heading" },
  { tag: T.comment, class: "cm-dpl-comment" },
  { tag: T.fmDelim, class: "cm-dpl-fmdelim" },
  { tag: T.fmKey, class: "cm-dpl-fmkey" },
  { tag: T.fmVal, class: "cm-dpl-fmval" },
]);

// --- Section heading names: a line-spanning concern the stream tokenizer can't see ----------
// A section name is a line whose NEXT line is the `={3,}` underline (the same rule the engine's
// parser uses). That needs cross-line lookahead, which a StreamLanguage tokenizer doesn't have, so
// a view plugin marks those name lines instead. Special sections (Start / Auto Begin / Auto End)
// get their own emphasis.
const SPECIAL_SECTION = /^(?:start|auto\s+(?:begin|start|end))$/i;
const secNameDeco = Decoration.mark({ class: "cm-dpl-secname" });
const secSpecialDeco = Decoration.mark({ class: "cm-dpl-secname-special" });

/** Build mark decorations over every section-name line in the visible ranges. */
function buildSectionDecorations(view) {
  const builder = new RangeSetBuilder();
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const name = line.text.trim();
      if (
        name &&
        line.number < doc.lines &&
        !/^={3,}\s*$/.test(name) &&
        /^={3,}\s*$/.test(doc.line(line.number + 1).text.trim())
      ) {
        const bare = name.replace(/\s*\[.*$/, "").trim();
        builder.add(line.from, line.to, SPECIAL_SECTION.test(bare) ? secSpecialDeco : secNameDeco);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const sectionHighlighter = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildSectionDecorations(view);
    }
    update(u) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildSectionDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/**
 * The DPL language + its (theme-aware) highlighting, ready to drop into an editor's extensions.
 * @returns {import("@codemirror/state").Extension[]} Language support + highlighting.
 */
export function dplLanguage() {
  return [
    new LanguageSupport(dplStreamLanguage),
    syntaxHighlighting(dplHighlightStyle),
    sectionHighlighter,
  ];
}

export { dplKindBadge, inFrontMatter, dplCompletionSource } from "./dplComplete.js";
