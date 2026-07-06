# Reference — DPL global layers (auto-merge / dedup)

**Status: built.** When one dynamic prompt imports another (`{#weather}`, `+weather`, a nested `{#…}` token),
the imported generators behave as **global layers**: each one renders **once** per prompt, rendered as a
shared layer rather than re-run every time it is pulled in. This is an *auto-merge* — the author never wires
named parameters or dedup logic; importing the same thing twice simply collapses to one.

This pairs with [focus](focus-design.md): a high-focus generator is *pure*, so it merges as a clean single
layer; a low-focus one fills the frame. Together they let DPL cover a wide composition (many layers, each
contributing once) without the complexity of explicit parameters.

---

## 1. The rule

- **First occurrence wins.** The first time a generator resolves during a prompt expansion, it renders and is
  recorded. Any **later import** of that same (singular) generator renders to **nothing** — "it was already
  imported." So if two different scenes both pull in `{#weather}`, weather appears a single time.
- **User-typed input is always honored.** Tokens present in the **original prompt the user typed** (the first
  resolution pass) always render — even duplicates. If the user writes `{#weather}, {#weather}`, they get two.
  Dedup applies only to *imports* (tokens emitted by other generators in later passes), never to what the user
  asked for directly. Never disregard user input.
- **`stacking` opts out.** A generator that legitimately needs to appear more than once declares
  `stacking: true` (alias `multi: true`) in its front-matter; it is exempt from dedup and renders on every
  import. Default is **singular**.

```
---
description: Optional color (or multi-color)
stacking: true        ; this fragment garnishes many clauses — let it repeat
---
```

---

## 2. What stacks vs what is singular

The split is content judgment, but the principle is:

- **Singular (default) — global atmosphere / scene layers.** `weather`, `nature`, `water`, `eerie`,
  `mystical`, … — things that describe the scene as a whole. They should land **once**; a second import is
  redundant, so dedup drops it. `weather` is the canonical example.
- **Stacking — decorative, repeatable fragments.** `color`, `glow`, `neon`, `crystal`, … — a color or glow can
  apply to many different nouns in one scene (`{#color} crystal, {#color} gemstone`). These set
  `stacking: true` so each inline use renders. The chained decorators (`glow`→`color`, `neon`→`glow`,
  `crystal`→`glow`) are all stacking, so the chains don't silently collapse.

> The full classification across the catalog is part of the focus/fluff content pass; the four chained
> decorators above were marked at the time the engine landed so dedup didn't regress them.

---

## 3. How it works (engine)

Implemented in `engine/core/stages/dynamicPrompt.js`. The resolver loops, replacing `{#…}` tokens pass by pass:

- A per-expansion `dedup = { seen: Set, firstPass: bool }` is created for each `dynamicPrompt()` call (state
  never leaks between prompts).
- **Pass 0** operates on the original (user-typed) prompt, plus any auto-appended `{#fx}` / `{#artists}`:
  `firstPass = true`. These always render; each non-stacking generator's key is added to `seen`.
- **Passes ≥ 1** resolve nested imports the earlier passes emitted: `firstPass = false`. Before running a
  generator, if it is **not** `stacking` and its key is already in `seen`, it renders `""`; otherwise it runs
  and is recorded.
- Dedup keys on the **resolved generator key** — so a `{#scene}` group that picks `scene/beach`, and a later
  explicit `{#beach}`, dedup against each other (both are `scene/beach`).
- The compiled module exposes `stacking` (from front-matter `stacking` / `multi`); `compileDpl` reads it, and
  both loaders pass it through unchanged.

Empty results from a dropped import are collapsed by the `cleanup` stage (it splits on `,`, drops blank
segments, and rejoins), so a deduped token leaves no stray comma.

## See also

- [`focus-design.md`](focus-design.md) — purity dial; high focus → cleaner single layers.
- [`intensity-design.md`](intensity-design.md) — the magnitude dial.
- [`dpl-design.md`](dpl-design.md) — the base language.
- `engine/core/stages/dynamicPrompt.js` — the dedup loop + `stacking` check.
- `engine/core/dpl/dpl.js` — `stacking` front-matter parsing, exposed on the compiled module.
