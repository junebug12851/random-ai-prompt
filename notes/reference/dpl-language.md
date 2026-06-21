# Reference — The DPL (Dynamic Prompt Language) — mockup analysis

**Status: design / not yet built.** This page captures a full reading of the two DPL mockups in
`assets/mockup/` and the JS generator model they are meant to replace, as the starting point for actually
building the language. Nothing here is implemented yet — it is the analysis that precedes a parser/compiler.
The concrete, expanded language proposal that grew out of this analysis is in
[`dpl-design.md`](dpl-design.md).

The **DPL** is a proposed small *textual* scripting language for authoring `{#name}` dynamic prompts, so a
prompt author doesn't have to hand-write JavaScript (`export default function … _.random(…) …`). The idea is
old: the 2023-01-21/22 work sketched "a mockup of a simpler custom scripting language … may or may not be
implemented" (see [`../version/2023-01.md`](../version/2023-01.md)) — it never was before the project went
dormant. The two files now in `assets/mockup/` are that sketch, in two revisions. This is the language a DPL
file would compile down to the same fragment-string a JS generator returns today (see the JS model in
[`dynamic-prompts.md`](dynamic-prompts.md) and the runtime sigils in [`prompt-dsl.md`](prompt-dsl.md)).

## The two mockups, and what they encode

Both mockups are textual rewrites of **existing** v2 generators, so they are a Rosetta Stone — the same
generator in two forms, DPL on the left, JS on the right.

| Mockup | Encodes | JS equivalent |
|--------|---------|---------------|
| `mockup-of-dpl-language.txt` | a beach scene (winter / tropical variants) | `data/dynamic-prompts/v2/scene/beach.js` |
| `mockup-of-dpl-language2.txt` | a cave scene (sea / lava / ice / crystal types) | `data/dynamic-prompts/v2/scene/cave.js` |

### Revision 1 — `mockup-of-dpl-language.txt` (beach)

```
====================
=- description: Generates a prompt for a beach with a city near it
=- full prompt
====================

====================
winter-beach:
====================
winter beach

*       snowy beach
*       (#ice)

====================
tropical-beach:
====================
tropical beach

*       palm trees
*fail   palm tree

====================
start:
====================
beach

*25%    +winter-beach
*fail   +tropical-beach

*       ocean
*       oceanside
*       seaside
... (more * lines)
*       {size} waves
*       #eerie
*20%    #mystical
*       #nature

#city, #weather
```

Reading it against `beach.js` line-for-line:

- A **header block** delimited by `====` lines carries metadata: `=- description: …` (the editor-tooltip
  sidecar) and a bare `=- full prompt` flag (= `export const full = true;`).
- **Named sections** are introduced by `name:` inside a `====` banner. `start:` is the **entry point** (the
  module's `default` function); the others (`winter-beach:`, `tropical-beach:`) are local subroutines —
  equivalent to the `winterBeach()` helper function in `beach.js`.
- The first line(s) of a section, written plain (no `*`), are the **unconditional base** — `"beach"`,
  `"winter beach"`, `"tropical beach"`. This is the START layer (see below).
- A `*` line is an **optional clause, default 50% probability** → `if (_.random(0,1,true) < 0.5) prompt +=
  ", …"`. The body is appended comma-joined.
- `*NN%` overrides the probability: `*25%` = 25%, `*20%` = 20% (`< 0.25` / `< 0.2` in JS).
- `*fail` is the **else branch of the immediately preceding probabilistic line** — it runs only when that
  roll failed. `*25% +winter-beach` / `*fail +tropical-beach` ⇒ `if (roll<0.25) winterBeach(); else
  tropicalBeach();`. (In `beach.js` the else-branch is a small inline block; the mockup factors it into a
  named `tropical-beach:` section.)
- `+name` **calls/inlines another local section** (subroutine reference). `+winter-beach` ⇒ `winterBeach()`.
- `#name` **embeds a dynamic-prompt generator** — the same `{#name}` token, written bare here. `#eerie`,
  `#mystical`, `#nature`, `#city`, `#weather`.
- `{name}` is a **list / wildcard** pull, exactly the runtime `{list}` sigil — `{size}`.
- `(…)` wraps output in **parentheses** (SD weight-grouping). `(#ice)` ⇒ the `({#ice})` in `winterBeach()`.
- The trailing **bare line with no `*`** — `#city, #weather` — is the **unconditional END layer**: always
  appended (⇒ `prompt += ", {#city}, {#weather}";`).

### Revision 2 — `mockup-of-dpl-language2.txt` (cave)

```
====================
=- description: Generates a prompt for a cave of different types and seasons
=- full prompt
====================

====================
select 1 cave-type:
====================
sea cave, #underwater
lava cave, #lava
ice cave, #ice
crystal cave, #crystal

====================
start:
====================
cave, cave walls

* subterranean
* interior
* +cave-type
* cavern
... (more * lines)
* #color crystal
* #color gemstone
... 
* {color}

#nature, #wildlife, #water, #eerie, #mystical, #weather
```

What revision 2 adds / changes:

- **`select N name:`** — a new section kind: a **pick-one(-of-N) group**. Each line is a candidate; the
  group emits `N` randomly chosen line(s). `select 1 cave-type:` ⇒ the `switch (_.random(0,4))` in `cave.js`
  that picks one of `sea cave/{#underwater}`, `lava cave/{#lava}`, `ice cave/{#ice}`, `crystal
  cave/{#crystal}`. This is the DPL spelling of the codebase's existing **pick-one group** concept (folders
  with 2+ generators, `.group` files — see [`prompt-dsl.md`](prompt-dsl.md)), but *inline within one file*.
- `* +cave-type` shows a `select` group is invoked like any other section via `+name`, and can itself be
  gated by a `*` roll (the cave switch is behind a 50% gate in JS).
- Spacing is looser (`* foo` vs `*       foo`) — whitespace after the marker is **not significant**; the
  `*`, `*fail`, `*NN%`, `+`, `#`, `{}` tokens are.
- A clause line can mix a `#name` embed with literal text: `#color crystal`, `#color gemstone` ⇒
  `", {#color} crystal"`, `", {#color} gemstone"`.

So the two revisions agree on the core grammar; **rev 1 expresses alternation via `*fail` chains + named
sections, rev 2 adds the `select N` group** as a cleaner pick-one. A real DPL would likely want both.

## Deduced grammar (union of both mockups)

| DPL construct | Meaning | JS / runtime equivalent |
|---------------|---------|--------------------------|
| `==== … ====` banner | section / header delimiter | (structural only) |
| `=- key: value` | metadata (`description`) | `<name>.json` sidecar |
| `=- full prompt` | marks the file a full scene | `export const full = true` |
| `name:` | named section (subroutine) | a JS function |
| `start:` | entry section | `export default function` |
| `select N name:` | pick-one(-of-N) group section | `switch`/`_.sample` over candidates |
| plain line (top of section) | unconditional base (START) | `let prompt = "…"` |
| `* text` | ~50% optional clause | `if (rand < 0.5) prompt += ", text"` |
| `*NN% text` | NN% optional clause | `if (rand < 0.NN) …` |
| `*fail text` | else-branch of the previous clause | `else …` |
| trailing plain line (END) | always appended | `prompt += ", …"` |
| `+name` | call/inline a local section | `helperFn()` |
| `#name` | embed a dynamic prompt | `{#name}` token |
| `{name}` | list / wildcard pull | `{list}` token |
| `(…)` | parenthesize (weight group) | `(…)` in the emitted string |

## Full vs partial — the model the DPL must preserve

This is the classification the whole catalog turns on, and the structural pattern the user identified
(start / middle / end layering + balancing). **Note:** start/middle/end describes the *v2 authoring habit*,
not a rule of the language — **v3 will be structured differently**, and the proposed DPL
([`dpl-design.md`](dpl-design.md)) does **not** enforce an anchor/tail; lines just run in document order. Authoritative JS detail is in
[`dynamic-prompts.md`](dynamic-prompts.md#full-vs-partial-the-classification-that-drives-everything); the
shape:

**A full prompt is a complete, self-standing scene; a partial is a building-block fragment that garnishes
other prompts.** `export const full = true` (DPL: `=- full prompt`) is the marker. `promptFilesAndSuggestions.js`
reads it to split the catalog into "Full Dynamic Prompts" vs "Partial Dynamic Prompts" (the web token picker
and the `{#random}`/`promptSuggestion()` engine). v1 and `user/` generators are always treated as full;
`suggestion_exclude` keeps a valid full out of random suggestions.

A **full** generator (`beach.js`, `cave.js`, `city.js`, …) is built by **probabilistic accretion** in three
layers:

1. **START — the anchor.** One unconditional base phrase naming the subject: `"beach"`, `"cave, cave walls"`,
   `"city, streetview, {city}"`. Always present; everything else accretes onto it.
2. **MIDDLE — the balanced body.** A run of independent optional clauses, each a *separate* coin-flip
   (mostly 50%, some weighted 25%/20%, some mutually-exclusive via `*fail` chains or a `select` group). The
   **balancing** is exactly this independence: with ~N clauses at p≈0.5, on average ~N/2 appear, but *which*
   ones vary every run — so output is richly varied yet never lopsided, and no single clause dominates.
   Weighted clauses (25%/20%) deliberately make rarer features rare; `*fail`/`select` enforce "pick one of
   these alternatives, not several."
3. **END — the unconditional context.** A trailing always-appended set of *other* dynamic prompts that
   place the scene in an environment: `#city, #weather` (beach); `#nature, #wildlife, #water, #eerie,
   #mystical, #weather` (cave). After the generator returns, the **engine** additionally auto-appends
   `{#fx}` and `{#artists}` (when `autoAddFx`/`autoAddArtists` are on and not already present) — the style
   layer that finishes a full prompt. (v1 fulls bake fx/artists in themselves and force the auto-append off.)

A **partial** (`ice.js`, `color`, `nature`, `weather`, `eerie`, `mystical`, …):

- has **no `full` flag** (DPL: no `=- full prompt`);
- **starts from an empty string** (`let prompt = ""`) and emits only `", fragment"` clauses — it is *all
  MIDDLE*, no anchor and no trailing context, so it slots cleanly into a parent's comma list;
- is the unit that fulls compose from (the END layer of `cave.js` is literally a chain of partials), and the
  garnish `prePrompt()` sprinkles into suggestions.

So the DPL's full/partial distinction is structural, not just a flag: a **full** file has a real START base +
a trailing END context line; a **partial** file is a body of `*` clauses with an empty base and no trailing
context. The `=- full prompt` header makes it explicit for the classifier and UI.

The randomization envelope (emphasis, editing, alternating, `chaos` scaling, `keywordRepeater`) is applied
*later* by the list/randomization stages, not by the generator/DPL — see
[`prompt-dsl.md`](prompt-dsl.md#the-randomization-math). The DPL only decides *which clauses appear and what
text/tokens they contribute*.

## Open questions for building the DPL (gaps the mockups leave)

The mockups are deliberately incomplete; these are the decisions a parser/compiler design has to settle:

- **`*fail` scope.** Is `*fail` strictly the else of the single preceding clause, or can it chain
  (`*` / `*fail` / `*fail` as if/elseif/else)? Both mockups only show one `*fail` per clause.
- **`select N`** for N>1: distinct picks or with-replacement? Order preserved? Interaction with a `*` gate
  on the `+ref` (rev 2 gates the whole group at 50%).
- **Probability of base/`select`/END lines** — confirmed unconditional, but is there a syntax to gate the
  END line, or to give the base a probability?
- **Literal escaping** — how to emit a literal `#`, `{`, `(`, `*`, or a leading `=` (none of the mockups
  need it).
- **Comments**, blank-line significance (currently blank lines appear cosmetic), and whether `description`
  can be multi-line.
- **File identity / location** — extension (`.dpl`?), where DPL files live vs `.js` generators, and whether
  they coexist (a loader that reads both) or DPL compiles to JS at build time.
- **Compile target** — interpret a DPL AST at runtime inside `dynamicPrompt.js`, or transpile to the
  existing `export default function` shape so nothing downstream changes. The latter keeps the whole
  classifier / suffix-resolution / gating machinery untouched.
- **NSFW gating, `-v1`/`user` namespaces, `_force-prefix`, `.group` markers** — how the DPL surfaces (or
  inherits) the name-token gating and folder conventions that already govern the JS catalog.
- **Variants** — whether the DPL exposes `-sfw`/`-nsfw` or `{#any}` semantics, or leaves those to the engine.

## Where each piece lives

| Concern | Location |
|---------|----------|
| The two mockups | `assets/mockup/mockup-of-dpl-language{,2}.txt` |
| JS generators the mockups encode | `data/dynamic-prompts/v2/scene/{beach,cave}.js` |
| Full/partial classifier | `src/promptFilesAndSuggestions.js` |
| Runtime sigils / pipeline | [`prompt-dsl.md`](prompt-dsl.md), `src/core/stages/dynamicPrompt.js` |
| JS authoring idiom & catalog | [`dynamic-prompts.md`](dynamic-prompts.md) |
| Original 2023 mockup history | [`../version/2023-01.md`](../version/2023-01.md) |
