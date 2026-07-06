/**
 * The catalog behind the prompt box's DPL insert toolbar: the non-text DPL constructs (chances,
 * choices, repeats, structure, flow, emphasis, code) grouped into categories, each with a human
 * label + description, the literal syntax it inserts, and a CodeMirror snippet `template` (with
 * `${…}` tab stops) applied at the cursor.
 *
 * Every construct here mirrors the grammar in `src/core/dpl/dpl.js` (gates `maybe` / `NN% chance`
 * / `otherwise`; choices `one of` / `N of` / `A to B of` with an optional `(NN% nothing)` miss;
 * `repeat N times`; flow `go to` / `go back`; refs `insert` / `+call` / `insert js:` (external JS
 * file only — no inline JS); a leading `[weight]`; `===` headings; `;` comments) plus the downstream
 * engine emphasis (`()` / `[]` / `:weight`), translated per-dialect by the emphasis stage.
 *
 * The catalog is localized: {@link getDplInserts} takes an `intl` (from `useIntl()`) and returns the
 * structure with `label`/`hint`/`desc` translated. The `syntax` / `template` / `example` fields are
 * literal DPL code and stay verbatim in every locale.
 *
 * Template conventions:
 *   - `${1:foo}` is a numbered tab stop with a default — the editor selects it so you can type over it.
 *   - `${sel}` (wrap items only) is replaced with the current selection before insertion.
 *   - `line: true`  → the snippet is a line-leading construct; the editor pushes it onto a fresh line.
 *   - `wrap: true`  → the snippet wraps the current selection (emphasis et al.).
 *   - `example`     → concrete, real-word DPL the toolbar re-rolls live (only where output is meaningful).
 * @module gui/lib/dpl/dplInserts
 */
import { m } from "./dplInsertsMessages.js";

/**
 * Build the localized DPL insert catalog.
 * @param {import("react-intl").IntlShape} intl The react-intl instance (from `useIntl()`).
 * @returns {InsertCategory[]} The categories with translated `label`/`hint`/`desc`.
 */
export function getDplInserts(intl) {
  const t = (d, values) => intl.formatMessage(d, values);
  return [
    {
      key: "structure",
      label: t(m.structureLabel),
      hint: t(m.structureHint),
      items: [
        {
          id: "bullet",
          label: t(m.bulletLabel),
          desc: t(m.bulletDesc),
          syntax: "- <text>",
          template: "- ${1:detail}",
          line: true,
          example: "- soft rim lighting",
        },
        {
          id: "weight",
          label: t(m.weightLabel),
          desc: t(m.weightDesc),
          syntax: "[<N>] <text>",
          template: "[${1:100}] ${2:detail}",
          line: true,
          example: "[20] painted last\n[10] painted first",
        },
        {
          id: "heading",
          label: t(m.headingLabel),
          desc: t(m.headingDesc),
          syntax: "Name\n===",
          template: "${1:Section Name}\n===\n${2:content}",
          line: true,
        },
      ],
    },
    {
      key: "chance",
      label: t(m.chanceLabel),
      hint: t(m.chanceHint),
      items: [
        {
          id: "maybe",
          label: t(m.maybeLabel),
          desc: t(m.maybeDesc),
          syntax: "maybe <text>",
          template: "maybe ${1:detail}",
          line: true,
          example: "maybe golden hour lighting",
        },
        {
          id: "pct-chance",
          label: t(m.pctChanceLabel),
          desc: t(m.pctChanceDesc),
          syntax: "<N>% chance <text>",
          template: "${1:30}% chance ${2:detail}",
          line: true,
          example: "30% chance golden hour lighting",
        },
        {
          id: "otherwise",
          label: t(m.otherwiseLabel),
          desc: t(m.otherwiseDesc),
          syntax: "otherwise <text>",
          template: "otherwise ${1:detail}",
          line: true,
          example: "50% chance bright daylight\notherwise moody shadows",
        },
      ],
    },
    {
      key: "choose",
      label: t(m.chooseLabel),
      hint: t(m.chooseHint),
      items: [
        {
          id: "one-of",
          label: t(m.oneOfLabel),
          desc: t(m.oneOfDesc),
          syntax: "one of\n  - a\n  - b",
          template: "one of\n  - ${1:option}\n  - ${2:option}",
          line: true,
          example: "one of\n  - crimson\n  - teal\n  - amber",
        },
        {
          id: "n-of",
          label: t(m.nOfLabel),
          desc: t(m.nOfDesc),
          syntax: "<N> of\n  - a\n  - b",
          template: "${1:2} of\n  - ${2:option}\n  - ${3:option}\n  - ${4:option}",
          line: true,
          example: "2 of\n  - crimson\n  - teal\n  - amber\n  - gold",
        },
        {
          id: "range-of",
          label: t(m.rangeOfLabel),
          desc: t(m.rangeOfDesc),
          syntax: "<N> to <M> of\n  - a\n  - b",
          template: "${1:1} to ${2:2} of\n  - ${3:option}\n  - ${4:option}",
          line: true,
          example: "1 to 2 of\n  - crimson\n  - teal\n  - amber",
        },
        {
          id: "one-of-nothing",
          label: t(m.oneOfNothingLabel),
          desc: t(m.oneOfNothingDesc),
          syntax: "one of (<N>% nothing)\n  - a\n  - b",
          template: "one of (${1:25}% nothing)\n  - ${2:option}\n  - ${3:option}",
          line: true,
          example: "one of (40% nothing)\n  - sparkles\n  - lens flare",
        },
      ],
    },
    {
      key: "repeat",
      label: t(m.repeatLabel),
      hint: t(m.repeatHint),
      items: [
        {
          id: "repeat-n",
          label: t(m.repeatNLabel),
          desc: t(m.repeatNDesc),
          syntax: "repeat <N> times\n  - body",
          template: "repeat ${1:2} times\n  - ${2:thing}",
          line: true,
          example: "repeat 2 times\n  - one of\n    - star\n    - swirl",
        },
        {
          id: "repeat-range",
          label: t(m.repeatRangeLabel),
          desc: t(m.repeatRangeDesc),
          syntax: "repeat <N> to <M> times\n  - body",
          template: "repeat ${1:1} to ${2:3} times\n  - ${3:thing}",
          line: true,
          example: "repeat 1 to 3 times\n  - one of\n    - star\n    - swirl",
        },
      ],
    },
    {
      key: "flow",
      label: t(m.flowLabel),
      hint: t(m.flowHint),
      items: [
        {
          id: "goto",
          label: t(m.gotoLabel),
          desc: t(m.gotoDesc),
          syntax: "go to <Section>",
          template: "go to ${1:Section Name}",
          line: true,
        },
        {
          id: "goback",
          label: t(m.gobackLabel),
          desc: t(m.gobackDesc),
          syntax: "go back",
          template: "go back",
          line: true,
        },
        {
          id: "insert",
          label: t(m.insertLabel),
          desc: t(m.insertDesc),
          syntax: "insert <name>",
          template: "insert ${1:name}",
          line: true,
        },
        {
          id: "call",
          label: t(m.callLabel),
          desc: t(m.callDesc, { token: "{#name}" }),
          syntax: "+<name>",
          template: "+${1:name}",
          line: true,
        },
        {
          id: "insert-js",
          label: t(m.insertJsLabel),
          desc: t(m.insertJsDesc),
          syntax: "insert js: <path>",
          template: "insert js: ${1:path}",
          line: true,
        },
      ],
    },
    {
      key: "emphasis",
      label: t(m.emphasisLabel),
      hint: t(m.emphasisHint),
      items: [
        {
          id: "emph",
          label: t(m.emphLabel),
          desc: t(m.emphDesc),
          syntax: "(text)",
          template: "(${sel})",
          wrap: true,
        },
        {
          id: "emph-strong",
          label: t(m.emphStrongLabel),
          desc: t(m.emphStrongDesc),
          syntax: "((text))",
          template: "((${sel}))",
          wrap: true,
        },
        {
          id: "de-emph",
          label: t(m.deEmphLabel),
          desc: t(m.deEmphDesc),
          syntax: "[text]",
          template: "[${sel}]",
          wrap: true,
        },
        {
          id: "emph-weight",
          label: t(m.emphWeightLabel),
          desc: t(m.emphWeightDesc),
          syntax: "(text:1.2)",
          template: "(${1:text}:${2:1.2})",
        },
      ],
    },
    {
      key: "code",
      label: t(m.codeLabel),
      hint: t(m.codeHint),
      items: [
        {
          id: "comment",
          label: t(m.commentLabel),
          desc: t(m.commentDesc),
          syntax: "; <note>",
          template: "; ${1:note}",
          line: true,
        },
        {
          id: "salt",
          label: t(m.saltLabel),
          desc: t(m.saltDesc),
          syntax: "{salt}",
          template: "{salt}",
          example: "{salt}",
        },
      ],
    },
  ];
}

export default getDplInserts;
