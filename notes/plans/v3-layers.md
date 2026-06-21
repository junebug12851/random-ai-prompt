# Plan / Concept — v3: the weighted-layer prompt engine

**Status: exploratory / actively being shaped — not built, much still undecided.** This captures the v3
direction as discussed so it isn't lost. Anything marked *(open)* is unsettled. v3 is the model the DPL
([../reference/dpl-design.md](../reference/dpl-design.md)) is meant to author for.

## The shift

v1/v2 build a prompt as an **ordered string** — position *is* meaning. When a user stacks several building
blocks, their tokens interleave in whatever order they were written, causing duplication and messy ordering,
and forcing every "full" scene to re-emit its own start (quality/composition) and end (fx/artists/weather)
boilerplate.

v3 replaces ordering-by-position with **ordering-by-weight over a layer tree**. The author/engine controls
where something lands by giving it a weight, not by where it sits in the text.

## The layer model

- **Everything is a layer, nested:** a **file** is a layer, each **section** in it is a layer, each **line**
  in a section is a layer. The tree mirrors DPL structure.
- **The user's prompt box is the root layer;** every building block they list is a child layer. So the whole
  prompt is one layer hierarchy.
- **Weights are plain numbers** (not AUTOMATIC1111 attention) — a **sort key**. **Lower = higher priority =
  rendered closer to the front (left); higher = lower priority = further back (right).** A line at the bottom
  of a file with weight `2` renders near the top.
- **Auto-assigned weights:** a line with no explicit weight gets **the next number** in document order.
  Explicit weight is written at the **start of the line/block** *(open: exact syntax)*.
- **Files have no weight** — that would break modularity (a file must drop into any prompt). Only the
  **sections/lines inside** a file carry weights.
- **Render:** collect the tree → flatten → **sort by weight** → emit left(low)→right(high). Full
  de-duplication may not be fully achievable, but a **layer-aware engine allows smarter management** (merging
  / grouping / less duplication) than blind string concatenation. *(open: exactly what "smarter management"
  does beyond sorting.)*

## Retiring "full prompts" + start/end boilerplate

A central goal: **remove the "full prompt" concept** (the v2 `full` flag) and the duplicated start/end
material that every full scene currently carries. Instead the **engine supplies the beginning and ending
blocks**, so building blocks mostly provide the "middle." Benefits: less duplication, faster authoring,
consistent framing.

- **Delivery mechanism** *(open, leaning preset):* a **preset** holding the start + end blocks is more
  flexible and customizable and fits the app, versus a **settings page** (feels permanent / off-to-the-side).
  A literal **3-box** (start / middle / end) UI is another option. Undecided — needs UX thought.
- The user still **writes the prompt normally** and does **not** hand-specify weights; weights come from the
  files/engine.

## Read-only variables

DPL and JS building blocks can **read** variables (settings, and richer engine/user context) but **never
define or assign** them — read-only access only. The aim is deeper, richer integration between the **prompt
engine**, its **building blocks**, and the **user**. Mostly future. *(open: what variables exist and how
they're surfaced.)*

## DPL's role

DPL is the **default** authoring language for v3 layers, with **JavaScript still supported** (the two-way
bridge in [../reference/dpl-design.md §6](../reference/dpl-design.md)). v3 wants layers wired **through the
prompt engine** itself rather than bolted on as string-rewriting stages.

## Open questions (the mechanics that decide the rest)

1. **Weight comparison scope** — when building blocks A and B both pour their lines into the root, do their
   weights compare on **one global scale** (so every weight-0 line clusters at the very front regardless of
   source — the mechanism that would unify start/end material), or are weights **per-file** and then combined
   with the parent's position somehow?
2. **Effective sort key** — is a flattened line's order a **single number**, or a **tuple** (section weight,
   then line weight, …) walked down the tree? "Weight within the layer above it" hinted at combining down the
   chain; "files have no weight" simplifies it.
3. **Tie-breaking** — when two layers share a weight, what decides order (document order, building-block
   order, merge)?
4. **Smarter management** — beyond sort: dedup exact repeats? collapse near-duplicates? cap per band?
5. **Start/end UX** — preset vs 3 boxes vs settings; how the engine knows which blocks are start/end.
6. **Weight syntax in DPL** — how an author writes an explicit weight at the start of a line/block, and how
   it coexists with the gate/repeat prefixes (`25%`, `repeat …`).

## See also

- [../reference/dpl-design.md](../reference/dpl-design.md) — the authoring language for these layers.
- [../reference/dpl-language.md](../reference/dpl-language.md) — the original mockups.
- [../reference/dynamic-prompts.md](../reference/dynamic-prompts.md) — the v2 full/partial model being retired.
