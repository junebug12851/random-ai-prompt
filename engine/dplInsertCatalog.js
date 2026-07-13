/**
 * @file The DPL **insert catalog** — the engine's own grammar, described once, for every target.
 *
 * This is the list of non-text DPL constructs (structure, chance, choose, repeat, flow, emphasis,
 * code) that the prompt box's Insert menu offers: for each one, the literal `syntax`, an editor
 * `template` and — where output is meaningful — a live `example`. Every entry mirrors a rule the DPL
 * compiler in `engine/core/dpl/dpl.js` actually implements. **It is a description of the engine's
 * language, so it belongs to the engine** — not to the web app that happened to build the first menu.
 *
 * It used to live twice: `targets/web/frontend/lib/dpl/dplInserts.js` and a 262-line hand-port in
 * `targets/mobile/lib/dplInserts.js`, kept honest by a drift check (`checkDplInserts`). That check is
 * deleted with this file's arrival — a copy that can't exist can't drift. (See
 * `notes/plans/de-duplication.md`; this was the last hand-port in the campaign.)
 *
 * ## What lives here and what does NOT
 *
 * **Here:** everything language-neutral — the ids, the DPL text, the structure. Change the grammar,
 * change it once.
 *
 * **Not here:** the human labels. The web localizes them through react-intl (`dplInsertsMessages.js`)
 * and the mobile app ships English strings; a target's label layer is a **presentation** concern with
 * different machinery on each platform. Forcing one on the other would import the web's i18n
 * dependency into React Native for no gain. So each target attaches its own labels via
 * {@link buildInsertMenu} — the shared thing is shared, the platform-specific thing stays put.
 *
 * ## Template conventions (the same in every target)
 *
 * - `${1:foo}` — a numbered tab stop with a default (CodeMirror selects it so you can type over it).
 * - `${sel}`   — the current selection, for `wrap` items (emphasis et al.).
 * - `line: true` — a line-leading construct; the editor pushes it onto a fresh line.
 * - `wrap: true` — wraps the current selection.
 * - `example`    — concrete DPL the menu re-rolls live.
 */

/**
 * The categories and their constructs. Language-neutral: ids, DPL syntax, snippet templates, examples.
 * @type {Array<{key: string, items: Array<{id: string, syntax: string, template: string, line?: boolean, wrap?: boolean, example?: string, descValues?: Record<string, string>}>}>}
 */
export const DPL_INSERT_CATALOG = [
  {
    key: "structure",
    items: [
      {
        id: "bullet",
        syntax: "- <text>",
        template: "- ${1:detail}",
        line: true,
        example: "- soft rim lighting",
      },
      {
        id: "weight",
        syntax: "[<N>] <text>",
        template: "[${1:100}] ${2:detail}",
        line: true,
        example: "[20] painted last\n[10] painted first",
      },
      {
        id: "heading",
        syntax: "Name\n===",
        template: "${1:Section Name}\n===\n${2:content}",
        line: true,
      },
    ],
  },
  {
    key: "chance",
    items: [
      {
        id: "maybe",
        syntax: "maybe <text>",
        template: "maybe ${1:detail}",
        line: true,
        example: "maybe golden hour lighting",
      },
      {
        id: "pct-chance",
        syntax: "<N>% chance <text>",
        template: "${1:30}% chance ${2:detail}",
        line: true,
        example: "30% chance golden hour lighting",
      },
      {
        id: "otherwise",
        syntax: "otherwise <text>",
        template: "otherwise ${1:detail}",
        line: true,
        example: "50% chance bright daylight\notherwise moody shadows",
      },
    ],
  },
  {
    key: "choose",
    items: [
      {
        id: "one-of",
        syntax: "one of\n  - a\n  - b",
        template: "one of\n  - ${1:option}\n  - ${2:option}",
        line: true,
        example: "one of\n  - crimson\n  - teal\n  - amber",
      },
      {
        id: "n-of",
        syntax: "<N> of\n  - a\n  - b",
        template: "${1:2} of\n  - ${2:option}\n  - ${3:option}\n  - ${4:option}",
        line: true,
        example: "2 of\n  - crimson\n  - teal\n  - amber\n  - gold",
      },
      {
        id: "range-of",
        syntax: "<N> to <M> of\n  - a\n  - b",
        template: "${1:1} to ${2:2} of\n  - ${3:option}\n  - ${4:option}",
        line: true,
        example: "1 to 2 of\n  - crimson\n  - teal\n  - amber",
      },
      {
        id: "one-of-nothing",
        syntax: "one of (<N>% nothing)\n  - a\n  - b",
        template: "one of (${1:25}% nothing)\n  - ${2:option}\n  - ${3:option}",
        line: true,
        example: "one of (40% nothing)\n  - sparkles\n  - lens flare",
      },
    ],
  },
  {
    key: "repeat",
    items: [
      {
        id: "repeat-n",
        syntax: "repeat <N> times\n  - body",
        template: "repeat ${1:2} times\n  - ${2:thing}",
        line: true,
        example: "repeat 2 times\n  - one of\n    - star\n    - swirl",
      },
      {
        id: "repeat-range",
        syntax: "repeat <N> to <M> times\n  - body",
        template: "repeat ${1:1} to ${2:3} times\n  - ${3:thing}",
        line: true,
        example: "repeat 1 to 3 times\n  - one of\n    - star\n    - swirl",
      },
    ],
  },
  {
    key: "flow",
    items: [
      { id: "goto", syntax: "go to <Section>", template: "go to ${1:Section Name}", line: true },
      { id: "goback", syntax: "go back", template: "go back", line: true },
      { id: "insert", syntax: "insert <name>", template: "insert ${1:name}", line: true },
      {
        id: "call",
        syntax: "+<name>",
        template: "+${1:name}",
        line: true,
        // The one entry whose description interpolates a value (the {#name} token it compiles to).
        descValues: { token: "{#name}" },
      },
      {
        id: "insert-js",
        syntax: "insert js: <path>",
        template: "insert js: ${1:path}",
        line: true,
      },
    ],
  },
  {
    key: "emphasis",
    items: [
      { id: "emph", syntax: "(text)", template: "(${sel})", wrap: true },
      { id: "emph-strong", syntax: "((text))", template: "((${sel}))", wrap: true },
      { id: "de-emph", syntax: "[text]", template: "[${sel}]", wrap: true },
      { id: "emph-weight", syntax: "(text:1.2)", template: "(${1:text}:${2:1.2})" },
    ],
  },
  {
    key: "code",
    items: [
      { id: "comment", syntax: "; <note>", template: "; ${1:note}", line: true },
      { id: "salt", syntax: "{salt}", template: "{salt}", example: "{salt}" },
    ],
  },
];

/**
 * `one-of-nothing` → `oneOfNothing`. The label key a target uses for an entry is derived from its id,
 * so a new construct can't be added to the grammar without a label existing for it (the coverage test
 * in `tests/unit/dplInsertCatalog.test.js` fails). One id, one name, in every target.
 * @param {string} id A catalog category key or item id.
 * @returns {string} The camelCase form.
 */
export function camelId(id) {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Strip an editor template down to plain text — `${1:foo}` → `foo`, `${sel}` → nothing.
 *
 * Needed by any target without a snippet-aware editor (the mobile app has a plain `TextInput`, not
 * CodeMirror), so it inserts the concrete text instead of the tab-stop form.
 * @param {string} template The `template` field of a catalog item.
 * @returns {string} Insertable text.
 */
export function materializeTemplate(template) {
  return template
    .replace(/\$\{\d+:([^}]*)\}/g, "$1") // ${1:foo} -> foo
    .replace(/\$\{sel\}/g, "") // ${sel} -> (nothing; no selection)
    .replace(/\$\{\d+\}/g, ""); // bare ${1} -> nothing
}

/**
 * Attach a target's label layer to the shared grammar, producing the menu the UI renders.
 * @param {object} labellers
 * @param {(category: object) => {label: string, hint: string}} labellers.category Labels for a category.
 * @param {(item: object, category: object) => {label: string, desc: string}} labellers.item Labels for an item.
 * @returns {Array<object>} The catalog with `label`/`hint`/`desc` filled in.
 */
export function buildInsertMenu({ category, item }) {
  return DPL_INSERT_CATALOG.map((c) => ({
    ...c,
    ...category(c),
    items: c.items.map((it) => ({ ...it, ...item(it, c) })),
  }));
}

export default DPL_INSERT_CATALOG;
