# Reference — DPL design proposal (the complete language)

**Status: proposal / not yet built.** A concrete design for the Dynamic Prompt Language, derived from reading
the whole v2 generator catalog (`data/dynamic-prompts/v2/`). It builds on the two mockups in
[`dpl-language.md`](dpl-language.md) and the JS authoring model in [`dynamic-prompts.md`](dynamic-prompts.md).

The guiding line: **DPL is data, not code.** It describes *what to maybe say* — probabilities, choices,
repetition, and flow between labeled blocks — in something that reads like a Markdown bullet list. Anything
that looks like programming — variables, counters, flags, conditions on state, arguments — **does not exist in
DPL**; it lives in referenced JavaScript. This keeps the language usable by non-programmers and the hard logic
in a real language.

> **Scope note.** This describes the *language*, not the v2 "start / middle / end" prompt shape — that was a
> v2 habit and **v3 will be structured differently**. DPL enforces no anchor/tail; lines run in document
> order. `Start` is kept only as the **entry point** (where generation begins).

## Design goals

1. **Reads like Markdown** — headings, bullet lists, indentation, YAML front-matter.
2. **No programming in the language** — no variables, counters, flags, state conditions, or arguments.
   Probabilities are `25%`; choice is "one of"; repetition is "repeat 3 times"; flow is "go to".
3. **JavaScript escape hatch for everything logical** — a `.dpl` may call a JS file for an inline value **or**
   insert a JS-produced block. JS is where counters/flags/arguments/state live.
4. **Compiles to the existing generator contract** — `(settings, imageSettings, upscaleSettings) => string` —
   so the engine downstream is untouched and `.js`/`.dpl` coexist during migration.

---

## 1. File shell: front-matter, sections, indentation

### Front-matter (`---` fenced YAML, all keys optional)

```
---
type: full              ; full | partial   (partial is the default)
description: A beach with a city nearby    ; → the .json tooltip sidecar
suggestions: off        ; → keep out of {#random} suggestions (suggestion_exclude)
script: beach.js        ; optional whole-file JS delegation (see §6)
---
```

| Front-matter | JS equivalent |
|--------------|---------------|
| `type: full` | `export const full = true` |
| `description:` | `<name>.json` sidecar |
| `suggestions: off` | `export const suggestion_exclude = true` |
| `script:` | delegate the whole body to a `.js` (§6) |

**No `auto-fx` / `auto-artists`** (v2 settings, out of scope for v3) and **no `adult` key** — NSFW gating is
inferred from the **name token only** (the existing `isGatedDynPrompt` rule), so gating can never disagree
with the filename.

### Sections (headings, underline of `=` ×**≥3**)

A heading names a section; the underline is **three or more** `=` (`===`, `====`, … all valid; only `<3` is
rejected). `Start` is the **entry point**; other sections are reached by flow (`go to`) or reuse
(`+name` / `insert`). `=` underline is the only heading form, leaving `#` for the `{#name}` token and `---`
for front-matter.

```
Start
=====
```

### Indentation

Nesting (gated blocks, choice options, loop bodies) is shown by indentation. **The first indented line in the
file sets the unit** — if it is a tab, the file indents with tabs; if it is N spaces, the file indents in
multiples of N. The whole file must then be consistent; mixing is an error. (So the author's own first choice
defines the rule — no global spaces-vs-tabs mandate.)

### Lines

- A **plain line** is always emitted: `beach`, or a trailing `{#city}, {#weather}`.
- A **bullet** (`-`) is conditional — **50% by default**, overridable per §2.
- Tokens are unchanged from the runtime: `{list}`, `{cat/list}`, `{#prompt}`, `{#cat/prompt}`, `<expansion>`,
  `{keyword}`/`{artist}`. Hand-written emphasis passes through verbatim: `(black background)`, `[[castle]]`.
- `;` starts a comment to end of line.

---

## 2. Probability & gating (the cheat-sheet)

```
- ocean                  ; 50%  (bullet default)
- 25% palm trees         ; 25%
- 12.5% rare green comet ; decimals allowed
always-present clause     ; a plain line = 100%
- 100% also always        ; explicit bullet form, if preferred
```

**Gate a whole block** — indent the members; the gate decides if the block opens, then each inner bullet
rolls on its own:

```
- maybe:                 ; 50% gate
    - polished
    - shiny
- otherwise:             ; runs only if the preceding gate FAILED
    - dirty
    - grunge

- 30% chance:            ; explicit odds
    - frost
    - sub-zero
```

`maybe:` / `NN% chance:` open a gated block; `otherwise:` is its else, and they chain:

```
- 20% chance:
    - aurora
- otherwise 50% chance:  ; elseif
    - clouds
- otherwise:             ; final else
    - clear sky
```

(There is no state-based guard — conditions on "what was chosen" belong in JS, §6.)

---

## 3. Choice: "one of" / "N of"

Pick **one** option (the `select`/`switch` idiom):

```
- one of:
    - sea cave, {#underwater}
    - lava cave, {#lava}
    - ice cave, {#ice}
    - crystal cave, {#crystal}
```

Pick **more than one** — a fixed count or a range, chosen without repeats:

```
- two of:
    - gold trim
    - silver inlay
    - jeweled hilt

- 1 to 3 of:
    - moss
    - vines
    - lichen
```

**Weighted**, with an explicit empty option and/or a "miss" chance (the `color.js` choice and the
`cave`/`vehicle` overshoot where the switch sometimes lands on nothing):

```
- one of:
    - 50% multi-color
    - 50% {color}

- one of (25% nothing):
    - {#ice}
    - {#lava}
    - {#underwater}
```

A reusable choice is just a section reached by `+name` (call) — see §5.

---

## 4. Repetition

A literal count or a range. The gate and the repeat are **independent**, and the chance can apply once up
front or on every copy:

```
- repeat 3 times: {star}                 ; exactly 3, NO gate
- repeat 2 to 5 times: {color} {clothes} ; random 2–5, NO gate
- 50% repeat 0 to 3 times: {adjective}   ; gate FIRST (50%), then 0–3 copies  ← the v2 idiom
- repeat 4 times: 30% {bird}             ; loop 4×, each copy independently 30%
```

**Rule:** a `%` **before** `repeat` gates the loop **once**; a `%` **after** the colon rolls on **each
iteration**. For more than one per-iteration clause, use a block — the loop body is indented bullets, each
with its own odds:

```
- repeat 5 times:
    - 50% {color} {clothes}
    - 20% {accessory}
```

Counts are always literals or ranges — there are **no counter variables and no `repeat while`** (that is
logic; do it in JS, §6).

---

## 5. Flow: reuse and jumps

Generation runs **line by line, top to bottom, starting at `Start`**. Two kinds of movement:

**Reuse another section (it returns afterward):**

- **`+name`** — *call*: run section `name`, splice its output **inline** where the `+name` sits, then carry
  on. Same as a `{#name}` embed; both forms allowed. Use for an inline value.
- **`insert name`** — *block insertion*: run `name` and drop its output as a **block** at this indentation.
  Use when the reused thing is multi-line/structural rather than a single inline value.

**Jump (no automatic return):**

- **`go to name`** — move to section `name` and continue **downward from there** ("it naturally falls down").
- **`go back`** — return to the line right after the most recent `go to` (a return, so a `go to` can be a
  there-and-back detour).

```
Start
=====
beach
- 25% go to Winter
- otherwise go to Tropical

Winter
======
winter beach, {#ice}
go to Finish        ; jump past Tropical

Tropical
========
tropical beach, palm trees
go to Finish

Finish
======
{#weather}
```

Sequential fall-through **stops at the next heading** (so the helper sections below `Start` don't run on
their own); an intentional `go to` is what crosses into a labeled block and continues downward from it. A
`branch:` block is sugar for a weighted set of jumps:

```
- branch:
    - 30% go to Winter
    - 30% go to Tropical
    - otherwise go to Plain
```

---

## 6. The JavaScript bridge (two-way)

Everything stateful or logical — counters, flags, conditions on prior choices, arguments, the `entity` type
system, the keyword-pile / suggestion / danbooru builtins — lives in JavaScript. The bridge runs **both
ways**: DPL invokes JS, and JS invokes DPL.

### DPL → JS — three ways to reach code

**Whole-generator delegation** (front-matter `script:`): the file's default export gets
`(settings, imageSettings, upscaleSettings)` and returns the string.

```
---
type: full
description: A completely random pile of keywords
script: random-words.js
---
```

**Inline value** — `{js:path}` splices the string the JS file returns where it sits in a line:

```
Start
=====
{js:colorful.js} {flower}, {js:colorful.js} {animal}, (black background), very detailed
```

**Block insertion** — `insert js: path` runs the JS and drops its (possibly multi-line) output as a block at
this indentation. This is for helpers that emit several clauses, not just one value.

```
Start
=====
knight, warrior
- insert js: ./detail-stack.js
- {#landscape}
```

**Path resolution:** a path is **relative** to the `.dpl` file (`./detail-stack.js`, `../fragment/foo.js`) or
**root-absolute** from the project root with a leading `/` (`/src/helpers/keywordRepeater.js`).

### JS → DPL — the `ctx` bridge (call sections, hand control back)

Every JS reference receives a context object `ctx`. Besides the read-only `ctx.settings` /
`ctx.imageSettings` / `ctx.upscaleSettings` and a seeded `ctx.random`, it can **execute the DPL side and get
the result back** — the mirror of `+name` / `insert` / `{#…}`:

| `ctx` call | What it does | DPL equivalent |
|------------|--------------|----------------|
| `ctx.section("Cave-type")` | run a **section in this file**, return its rendered string | `+cave-type` |
| `ctx.prompt("#weather")` or `ctx.prompt("weather")` | run **another generator**, return its string | `{#weather}` |
| `ctx.list("color")` | pull one value from a `{list}` | `{color}` |
| `ctx.expand("- 50% foggy\n- {time}")` | hand an **inline DPL/token snippet** to the engine, return the result | (anonymous block) |

So a section is just a callable unit: executing it (from DPL via `+`/`go to`, or from JS via `ctx.section`)
runs its lines and returns the accumulated string. The handoff is symmetric and may recurse — JS can call a
section that itself calls JS — and control always comes back **with a string**.

```js
// detail-stack.js  — invoked by  - insert js: ./detail-stack.js
export default function (ctx) {
  let out = ctx.section("Base-details");          // run a DPL section, get its text
  if (ctx.settings.includeAdult) out += ", " + ctx.prompt("#spicy");
  const n = ctx.random.int(0, 3);
  for (let i = 0; i < n; i++) out += ", " + ctx.list("adjective");
  return out;                                     // back to DPL as a block
}
```

This is where the whole `entity` family goes (it sets flags like *human* that gate later clauses, and the
`animal`/`person`/`living` variants pass an argument to restrict the pool — both "programming"). The readable
scenes keep embedding `{#entity}` / `{#animal}` as today; only those few type-system files are JS.

---

## 7. Worked rewrites (real generators)

**`weather` (partial):**

```
---
type: partial
---
Start
=====
- {time}
- {weather}
```

**`fx` (partial)** — ungated-gate-then-loop and an expansion:

```
---
type: partial
---
Start
=====
- {art-movement}
- {art-technique}
- 50% repeat 0 to 3 times: {image-effect}
- <rays>
```

**`cave` (full) — all of `cave.js`:**

```
---
type: full
description: A cave of different types and seasons
---
Cave-type
=========
- one of:
    - sea cave, {#underwater}
    - lava cave, {#lava}
    - ice cave, {#ice}
    - crystal cave, {#crystal}

Start
=====
cave, cave walls
- subterranean
- interior
- 50% +cave-type
- cavern
- glow
- bioluminescent
- structures
- {#color} crystal
- {#color} gemstone
- stalagmite
- stalactite
- {#settlement}
- tunnels
- underground
- {color}

{#nature}, {#wildlife}, {#water}, {#eerie}, {#mystical}, {#weather}
```

**`vehicle` (full)** — maybe/otherwise block + a pick-with-miss:

```
---
type: full
---
Weather-fx
==========
- one of (25% nothing):
    - {#ice}
    - {#lava}
    - {#underwater}

Start
=====
vehicle, {scene/vehicle}
- +weather-fx
- {#color}
- {#color}
- {size}
- {mood} atmosphere
- detailed
- maybe:
    - reflective surface
    - polished
    - shiny
- otherwise:
    - dirty
    - grunge
    - broken
    - {#eerie}
    - {#nature}
    - {#wildlife}
- 25% {#mystical}
- {style/construct}
- {style/building}
- {#weather}
```

**`entity` (the logic-heavy one)** stays JavaScript — a one-line `.dpl`:

```
---
type: partial
description: A subject — animal, character, flower, instrument, creature, tree, or person
script: entity.js
---
```

---

## 8. Requirements coverage — every v2 pattern → how the DPL meets it

| v2 pattern | Exemplar file | DPL coverage |
|------------|---------------|--------------|
| Plain accretion of optional clauses | `beach`, `city` | plain lines + `- bullet` |
| Explicit / decimal probability | `beach`, `vehicle` | `- NN% …` |
| Always-on clause | trailing `prompt += …` | plain line / `- 100%` |
| Single either/or | `beach` winter/tropical | `- N% …` / `- otherwise …` |
| Grouped if/else block | `general-state`, `vehicle` | `- maybe:` / `- otherwise:` (indented) |
| Chained elseif | (latent) | `- otherwise NN% chance:` |
| Pick one of N | `cave`, `vehicle` | `- one of:` / `+name` |
| Pick more than one | (new need) | `- two of:` / `- 1 to 3 of:` |
| Pick with empty / miss | `color`, `cave`, `vehicle` | `- one of (NN% nothing):` |
| Weighted choice | `color` | weighted options under `one of` |
| Repetition — no gate | (your need) | `- repeat A to B times: …` |
| Repetition — gate first | `expressive`, `fx`, entity clothes | `- 50% repeat A to B times: …` |
| Repetition — per-copy chance | (your need) | `- repeat N times: NN% …` / loop block |
| Reusable local block (inline) | `winterBeach`, `Cave-type` | `+name` |
| Reusable block (structural) | (new) | `insert name` |
| Jump / branch between paths | (new) | `go to name`, `go back`, `- branch:` |
| Embed list / prompt / expansion / path tokens | everywhere | `{list}` `{#prompt}` `<exp>` `{cat/x}` |
| Hand-written emphasis | `knight`, `vibrant-art` | passes through verbatim |
| Metadata: full/partial, exclude, description | `*.js` exports | front-matter |
| NSFW gating | name-token rule | inferred from name only |
| Variables / flags / counters / state conditions | `entity` | **JS only** (`script:` / `{js:}` / `insert js:`) |
| Arguments to a helper | `animal`→`entity("animal")` | **JS only** |
| Space-joined / multi-line sub-builder | `vibrant-art`, builtins | `{js:…}` (inline) / `insert js:` (block) |
| Builtins (keyword pile, suggestion, danbooru) | `random-words`, `random`, `d` | `script:` |
| JS calls back into DPL (run a section/prompt, get its string) | (new need) | `ctx.section` / `ctx.prompt` / `ctx.list` / `ctx.expand` |
| Per-call resampling, depletion, randomization envelope | engine | unchanged (engine concern) |

---

## 9. Grammar sketch (informal)

```
file        := frontmatter? section+
frontmatter := "---" NL (key ":" value NL)* "---" NL
section     := TEXT NL "="{3,} NL line*            ; underline ≥3 '='
line        := plain | bullet | flow
plain       := TEXT                                ; always emitted
flow        := "go to" NAME | "go back"
bullet      := "-" [gate] [repeat] (":" NL block | choice | flow | payload)
gate        := NUMBER "%" | "maybe" | NUMBER "% chance" | "otherwise" [gate]
repeat      := "repeat" (INT | INT "to" INT) "times"
choice      := ("one of" | INT "of" | INT "to" INT "of") ["(" NUMBER "% nothing)"] ":" NL block
payload     := (TEXT | "{list}" | "{#prompt}" | "<exp>" | "{js:" PATH "}" | "+" NAME | "insert" (NAME | "js:" PATH))*
block       := (indent bullet)+                    ; indent unit = first indent in the file
PATH        := relative ("./" | "../" …) | root-absolute ("/" …)
```

No production for variables, counters, flags, conditions, arguments, or `while` — by design. Compilation
walks the tree with a seeded RNG and accrues the string a JS generator would have returned; `{js:}` /
`insert js:` / `script:` resolve against `.js` files; front-matter sets `full` / `suggestion_exclude` /
sidecar.

## 10. Open questions (for the build)

- **Fall-through vs heading boundary** — confirm the rule: sequential execution stops at the next heading,
  but a `go to` continues downward across headings from its target. (This is the model assumed above; worth a
  sanity check against a real multi-jump generator.)
- **`go back` depth** — single-level return (after the most recent `go to`) or a stack? Single-level is
  simpler and probably enough.
- **`one of` "N of" with weights/miss** — how weights and the "(NN% nothing)" miss interact when picking
  more than one.
- **Block-insertion indentation** — when `insert` drops a multi-line block, does it adopt the current
  indentation, and can the inserted block itself contain gated sub-blocks?
- **`ctx` bridge surface** — finalize the JS-side API (`ctx.section` / `ctx.prompt` / `ctx.list` /
  `ctx.expand`, plus `ctx.settings`/`ctx.random`), the sandbox boundary, and recursion/cycle limits when a
  section calls JS that calls the section again.
- **Section resolution from JS** — does `ctx.section(name)` see only this file's sections, and `ctx.prompt`
  the global `{#…}` catalog (suffix-resolved)? (Leaning yes — keeps local vs global clear.)
- **Editor support** — it's Markdown-shaped, so it highlights in any Markdown editor; a small live
  "expand this" preview in the SPA Build tab would close the loop for non-programmers.

## See also

- [`dpl-language.md`](dpl-language.md) — the two original mockups, decoded.
- [`dynamic-prompts.md`](dynamic-prompts.md) — the JS authoring idiom this compiles to.
- [`prompt-dsl.md`](prompt-dsl.md) — the runtime sigils and randomization math.
