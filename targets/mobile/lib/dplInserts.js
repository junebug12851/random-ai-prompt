/**
 * The catalog behind the prompt box's DPL insert menu: the non-text DPL constructs (structure,
 * chance, choose, repeat, flow, emphasis, code) grouped into categories, each with a human label +
 * hint, the literal syntax it inserts, a snippet `template`, and (where meaningful) a live example
 * the menu re-rolls every second. Mirrors the web `lib/dpl/dplInserts.js` (strings inlined in English
 * — mobile has no react-intl yet). `syntax` / `template` / `example` are literal DPL, verbatim.
 */

// A snippet template with ${1:default} tab-stops / ${sel} wrap markers. On mobile (no CodeMirror) we
// insert the concrete text, stripping the tab-stops to their defaults and dropping the wrap marker.
export function materialize(template) {
  return template
    .replace(/\$\{\d+:([^}]*)\}/g, "$1") // ${1:foo} -> foo
    .replace(/\$\{sel\}/g, "") // ${sel} -> (nothing; no selection on mobile)
    .replace(/\$\{\d+\}/g, ""); // bare ${1} -> nothing
}

export const DPL_INSERTS = [
  {
    key: "structure",
    label: "Structure",
    hint: "Bullets, ordering, and sections.",
    items: [
      {
        id: "bullet",
        label: "Bullet line",
        desc: "A bullet; a simple bullet defaults to a 50% chance.",
        syntax: "- <text>",
        template: "- ${1:detail}",
        line: true,
        example: "- soft rim lighting",
      },
      {
        id: "weight",
        label: "Priority weight",
        desc: "Pin a line's order — a lower number sorts earlier, wherever you type it.",
        syntax: "[<N>] <text>",
        template: "[${1:100}] ${2:detail}",
        line: true,
        example: "[20] painted last\n[10] painted first",
      },
      {
        id: "heading",
        label: "Section heading",
        desc: "A named section you can jump to with “go to”.",
        syntax: "Name\n===",
        template: "${1:Section Name}\n===\n${2:content}",
        line: true,
      },
    ],
  },
  {
    key: "chance",
    label: "Chance",
    hint: "Keep a line only some of the time.",
    items: [
      {
        id: "maybe",
        label: "Maybe",
        desc: "50% chance this line is kept.",
        syntax: "maybe <text>",
        template: "maybe ${1:detail}",
        line: true,
        example: "maybe golden hour lighting",
      },
      {
        id: "pct-chance",
        label: "N% chance",
        desc: "Custom probability the line is kept.",
        syntax: "<N>% chance <text>",
        template: "${1:30}% chance ${2:detail}",
        line: true,
        example: "30% chance golden hour lighting",
      },
      {
        id: "otherwise",
        label: "Otherwise",
        desc: "Runs only when the chance just above it failed.",
        syntax: "otherwise <text>",
        template: "otherwise ${1:detail}",
        line: true,
        example: "50% chance bright daylight\notherwise moody shadows",
      },
    ],
  },
  {
    key: "choose",
    label: "Choose",
    hint: "Pick from a set of options.",
    items: [
      {
        id: "one-of",
        label: "One of",
        desc: "Pick exactly one of the options.",
        syntax: "one of\n  - a\n  - b",
        template: "one of\n  - ${1:option}\n  - ${2:option}",
        line: true,
        example: "one of\n  - crimson\n  - teal\n  - amber",
      },
      {
        id: "n-of",
        label: "N of",
        desc: "Pick exactly N of the options.",
        syntax: "<N> of\n  - a\n  - b",
        template: "${1:2} of\n  - ${2:option}\n  - ${3:option}\n  - ${4:option}",
        line: true,
        example: "2 of\n  - crimson\n  - teal\n  - amber\n  - gold",
      },
      {
        id: "range-of",
        label: "N to M of",
        desc: "Pick a random count between N and M.",
        syntax: "<N> to <M> of\n  - a\n  - b",
        template: "${1:1} to ${2:2} of\n  - ${3:option}\n  - ${4:option}",
        line: true,
        example: "1 to 2 of\n  - crimson\n  - teal\n  - amber",
      },
      {
        id: "one-of-nothing",
        label: "One of, or nothing",
        desc: "Pick one — but sometimes nothing at all.",
        syntax: "one of (<N>% nothing)\n  - a\n  - b",
        template: "one of (${1:25}% nothing)\n  - ${2:option}\n  - ${3:option}",
        line: true,
        example: "one of (40% nothing)\n  - sparkles\n  - lens flare",
      },
    ],
  },
  {
    key: "repeat",
    label: "Repeat",
    hint: "Render the same body several times.",
    items: [
      {
        id: "repeat-n",
        label: "Repeat N times",
        desc: "Render the body exactly N times.",
        syntax: "repeat <N> times\n  - body",
        template: "repeat ${1:2} times\n  - ${2:thing}",
        line: true,
        example: "repeat 2 times\n  - one of\n    - star\n    - swirl",
      },
      {
        id: "repeat-range",
        label: "Repeat N to M times",
        desc: "Render the body a random N–M times.",
        syntax: "repeat <N> to <M> times\n  - body",
        template: "repeat ${1:1} to ${2:3} times\n  - ${3:thing}",
        line: true,
        example: "repeat 1 to 3 times\n  - one of\n    - star\n    - swirl",
      },
    ],
  },
  {
    key: "flow",
    label: "Flow & calls",
    hint: "Jump between sections and pull in other blocks.",
    items: [
      {
        id: "goto",
        label: "Go to section",
        desc: "Jump into another named section.",
        syntax: "go to <Section>",
        template: "go to ${1:Section Name}",
        line: true,
      },
      {
        id: "goback",
        label: "Go back",
        desc: "Stop / return from the current section.",
        syntax: "go back",
        template: "go back",
        line: true,
      },
      {
        id: "insert",
        label: "Insert by name",
        desc: "Insert another generator or list by name.",
        syntax: "insert <name>",
        template: "insert ${1:name}",
        line: true,
      },
      {
        id: "call",
        label: "Call (+name)",
        desc: "Call a generator or section by name (→ {#name}).",
        syntax: "+<name>",
        template: "+${1:name}",
        line: true,
      },
      {
        id: "insert-js",
        label: "Insert JS block",
        desc: "Insert the output of a named JS block.",
        syntax: "insert js: <path>",
        template: "insert js: ${1:path}",
        line: true,
      },
    ],
  },
  {
    key: "emphasis",
    label: "Emphasis",
    hint: "Nudge how strongly a phrase is weighted (the engine translates it for each AI).",
    items: [
      {
        id: "emph",
        label: "Emphasize",
        desc: "More attention on the wrapped text. Each extra ( adds a level (+10), capped at 5.",
        syntax: "(text)",
        template: "(${sel})",
        wrap: true,
      },
      {
        id: "emph-strong",
        label: "Emphasize strongly",
        desc: "Stack ( for more — (((text))) is the strongest. Renders as a weight (SD/MJ), braces (NovelAI), or an intensity word (plain).",
        syntax: "((text))",
        template: "((${sel}))",
        wrap: true,
      },
      {
        id: "de-emph",
        label: "De-emphasize",
        desc: "Less attention on the wrapped text. Stack [ for less; floors at the lowest level (never zero).",
        syntax: "[text]",
        template: "[${sel}]",
        wrap: true,
      },
      {
        id: "emph-weight",
        label: "Weighted phrase",
        desc: "Set an explicit numeric weight (passed through as-is).",
        syntax: "(text:1.2)",
        template: "(${1:text}:${2:1.2})",
      },
    ],
  },
  {
    key: "code",
    label: "Code",
    hint: "Inline JS, comments, and engine controls.",
    items: [
      {
        id: "comment",
        label: "Comment",
        desc: "A note ignored by the engine (to end of line).",
        syntax: "; <note>",
        template: "; ${1:note}",
        line: true,
      },
      {
        id: "salt",
        label: "Seed salt",
        desc: "Inject a random number to nudge the result.",
        syntax: "{salt}",
        template: "{salt}",
        example: "{salt}",
      },
    ],
  },
];
