# Performance — profiling & optimization

_Living reference for engine performance: where the time goes, the optimizations applied, and how to
re-measure. First full profiling pass: 2026-06-29 (2.28.18)._

## TL;DR

A full profiling sweep (core engine · loaders/startup · GUI/Vite build) found one dominant cost: the
**data loaders re-did all of their catalog work on every single generated prompt**. The on-disk (Node)
and bundled (browser) prompt catalog is *static* for the life of a process/page, yet every `{name}` pull
re-walked the whole `data/lists` tree and the reserved `keyword` wildcard re-unioned the *entire*
vocabulary from scratch. Memoizing the loaders' catalog enumeration and resolved-line sets took a single
prompt expansion from **~56 ms to ~0.2 ms (≈280× faster)** with **no behavior change** (235 Node + 237
web tests + smoke + build all green). The GUI build itself was already well-optimized and was left as-is.

## How to measure

There is no committed micro-benchmark (it would bit-rot); profile ad hoc from the repo root:

- **Per-prompt engine cost** — create a throwaway script that imports `createEngine` from
  `src/core/engine.js` + `nodeLoader` from `src/core/nodeLoader.js`, then time `engine.generate({ prompt })`
  over a few hundred iterations for representative prompts (`{#random-words}`, `{keyword}`×8, `{#any}`,
  `{#scene}`, a mixed one). Run it backgrounded (it can exceed a 30 s shell window): redirect to a file
  and poll.
- **Filesystem pressure (Node loader)** — wrap `fs.readdirSync/readFileSync/existsSync` with counters and
  count the calls for one `generate()`. This is what exposed the re-walk storm.
- **Build + bundle** — `npm run test:perf` (builds the SPA, then `scripts/check-bundle-size.mjs` gzips
  every `gui/dist/assets/*.js` against the 900 KB budget). Vite also prints per-chunk raw+gzip sizes.

## Baseline (before, 2026-06-29) and after

Measured on Node 24.12 on the dev machine; steady-state (post-warmup) per `generate()`:

| Prompt | Before | After |
|---|---|---|
| `{#random-words}` (default) | ~56 ms | ~0.28 ms |
| `{keyword}` × 8 | ~56 ms | ~0.18 ms |
| `{#fx}` | ~8 ms | ~0.02 ms |
| `readListLines('keyword')` (raw) | ~48 ms | ~0 ms (cached) |

Filesystem calls for **one** `generate()` of `{#random-words}` dropped from **208 `readdirSync` + 222
`readFileSync`** to ~0 once the per-process caches are warm. (The first prompt still pays the one-time
walk; every prompt after is served from cache.)

### Why it was slow

- `nodeLoader.readListLines(name)` rebuilt the entire list-name set on **every call** — `groupListDirs()`
  + `physicalListNames()` each recursively `readdirSync` the whole `data/lists` tree (~4 full walks per
  distinct list), and the list store clears its per-prompt cache on `reset()`, so this recurred for
  every prompt.
- The reserved **`keyword` wildcard** (`src/listResolve.js`) is a union of *all* general vocabulary: it
  iterates every list name, reads every file, and de-dupes hundreds of thousands of lines — ~48 ms — and
  it was rebuilt once per prompt.
- The `browserLoader` has no `fs`, but did the same logical work: it rebuilt the `allListNames(...)`
  array and re-resolved the `keyword` union on every `readListLines` call at runtime in the SPA.
- The dynamic-prompt stage rebuilt `resolvePool = [...names, ...groups]` for **every** `{#…}` token on
  **every** of its up-to-10 resolution passes.

## Optimizations applied (2.28.18)

All are pure memoization of values that are constant for the life of the process/page — **no semantic
change**.

1. **`src/core/nodeLoader.js` — memoize the static catalog + reads.** The directory walks
   (`physicalNames`, `markedDirs`, `dynGeneratorNames`, `groupListDirs`, the full `allNames()` set),
   `dynamicPromptNames()` (sorted), and the keyed reads (`readListLines` by `name|includeAdult`,
   `readListMeta`, `readDynPromptMeta`, `readDynPromptGroup`) are cached in module-level
   `Map`s/holders. A new `nodeLoader.refresh()` drops every cache for tooling/tests that mutate `data/`
   in place.
2. **`src/core/browserLoader.js` — memoize the name set + resolved lines.** `allNames()` is computed
   once; `readListLines` results are cached by `name|includeAdult`. Eliminates the per-prompt wildcard
   re-union in the SPA at runtime.
3. **`src/core/stages/dynamicPrompt.js` — hoist `resolvePool`.** Built once per stage call instead of
   per token per pass.

### Why this is safe (cache invalidation)

The `nodeLoader` (CLI / engine / smoke / tests) and the build-time `browserLoader` glob only ever **read**
a catalog that doesn't change during their run. The one place the catalog *does* change live — the SPA's
**Manage tab** — already reads through a **separate** `gui/src/lib/runtimeLoader.js` (a disk-snapshot
loader), never these loaders, so its hot-apply path is unaffected. Tests that interleave reads with writes
(`tests/integration/manageFs.test.js`) write through `buildManageSnapshot`, not `nodeLoader`, and pass
unchanged. If a future caller needs `nodeLoader` to see mid-process `data/` edits, call
`nodeLoader.refresh()`.

## GUI / Vite build — already healthy (left as-is)

The build is fast and well-structured; no change was warranted:

- **Build:** 671 modules transformed in ~**350 ms**.
- **Shipped JS:** **785 KB gzip total**, within the 900 KB budget (~115 KB headroom).
- **Chunking** (`gui/vite.config.js` `advancedChunks`) already isolates `react`, `intl`, `lodash`, and the
  big `prompt-data` glob; `Manage`, `SingleView`, and `Gallery` are lazy.

Largest gzipped chunks: `prompt-data` 431 KB · `index` (app) 173 KB · `react` 58 KB · `Manage` 54 KB
(lazy) · `lodash` 25 KB · `intl` 17 KB.

### Open ideas (not done — higher risk / lower ROI)

- **`prompt-data` (431 KB gzip)** is the entire offline vocabulary bundled for the Generate view. It's
  already its own cacheable chunk. Shrinking it would mean fetching lists on demand (an online/local
  split, real architecture work) — deferred.
- **`lodash` (25 KB gzip)** ships as the full library via `import _ from "lodash"` shared across the
  Node/browser engine. Moving to `lodash-es` + named imports could tree-shake it down, but it touches
  ~130 shared files and the lodash-RNG testing landmine — deferred.

## Landmine

The loaders are the catalog cache. **Do not** reintroduce per-call directory walks or per-call wildcard
unions in `nodeLoader`/`browserLoader` "for correctness" — the catalog is static and the Manage tab uses
`runtimeLoader` for live edits. If you genuinely need a fresh read in a long-lived Node process, call
`nodeLoader.refresh()` rather than removing the cache.
