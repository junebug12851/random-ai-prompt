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
- **Weights are LOCAL to the containing layer — they never propagate to the parent.** A layer's weights only
  reorder *that layer's own contents*; words **do not leave their containing layer**. This is what keeps
  blocks modular: a block can never reach up and reorder its siblings or the parent. (So there is **no global
  weight scale** — my earlier guess was wrong.)
- **Auto-assigned weights:** a line with no explicit weight gets **the next weight after the line before it**
  (incrementing within its section). A **section's** placement weight is **assigned by the code that includes
  it** — the section has no intrinsic weight; the includer decides where it sits among its siblings. Explicit
  weight is written at the **start of the line/block** *(open: exact syntax; and the auto-start value)*.
- **Files have no weight** — that would break modularity (a file must drop into any prompt). Only the
  **sections/lines inside** a file carry weights, and only relative to their own container.
- **Render is recursive, depth-first:** at each layer, **sort its direct children by their weights**, render
  each child (recursing), and concatenate. A layer therefore renders as a **contiguous, internally-sorted
  run**; its position among *its* siblings is set by the weight its parent gave it. The point: authors can
  write lines in whatever order reads best / is best commented, and the render reorders within the layer —
  **document order stops dictating output order.**
- **No de-duplication, by design.** The engine does **not** try to merge or shave duplicate words. The v2
  duplication problem wasn't repeated words per se — it was that **every "full" prompt auto-emitted its own
  start/end framing**, so stacking fulls piled up that framing. v3 removes that source (no full prompts; no
  auto start/end — see below). If a user deliberately stacks two blocks that both say "ocean," that's their
  choice, not a defect for the engine to fix.

## Retiring "full prompts" + start/end boilerplate

**The** central goal, and the main v2 pain point. In v2 every "full" scene re-emits its own start
(quality/composition) and end (fx/artists/weather) framing, so stringing fulls together piles up that framing
and the author has to shave the duplicates by hand. v3 **removes the "full prompt" concept** (the v2 `full`
flag) entirely: regular blocks no longer generate start/end material. Instead the **engine supplies the
beginning and ending blocks once**, so building blocks are just "middle." That single change removes the v2
duplication source — the engine never *de-duplicates*; it just stops *manufacturing* the duplicates.

Because weights are local, this works at the **root layer**: the engine's start block (low weight) and end
block (high weight) are sibling children of the root alongside the user's "middle" building blocks, so they
sort to the front and back of the whole prompt — without any words migrating out of the blocks themselves.

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

## Resolved mechanics

- **Weight scope = local.** Weights sort only within the containing layer; nothing propagates up; words never
  leave their layer. No global scale.
- **Sort = recursive depth-first** — each layer orders its own children, renders contiguously.
- **Auto weight = starts at `1000`**, +1 per line within the section. So written order = render order until an
  explicit weight overrides.
- **Explicit weight = `[n]`** as the leading token of a line/ref (e.g. `[900]`, `[50]`), before any
  gate/repeat. May also lead a section heading / first line to set the section's own weight. A reference
  (`+name`, `insert`, `go to`, JS) carries a weight for its result; **include-site weight > section's declared
  weight > auto**. (Fallback marker `@900` if brackets feel overloaded.)
- **Tie-break** = document order (general default).
- **No de-duplication** — a non-goal (see "Retiring full prompts").

## Build order

**DPL is implemented first** — it's the authoring layer wired *into* the v3 engine, so the parser/compiler and
the weighted-layer render model come before the start/end UX. (Start/end blocks build on a working DPL.)

## Open questions (still to decide)

1. **Start/end UX** — preset vs 3 boxes vs settings page; how the engine is told which blocks are start/end.
   (Deferred until DPL exists.)
2. **Read-only variables** — what variables exist and how they're surfaced to DPL/JS.
3. **Auto-weight collisions** — if an explicit `[n]` lands on an auto number, tie-break is document order;
   confirm nothing else is needed.

(De-duplication is **not** an open question — it is explicitly a non-goal; see "Retiring full prompts".)

## See also

- [../reference/dpl-design.md](../reference/dpl-design.md) — the authoring language for these layers.
- [../reference/dpl-language.md](../reference/dpl-language.md) — the original mockups.
- [../reference/dynamic-prompts.md](../reference/dynamic-prompts.md) — the v2 full/partial model being retired.
