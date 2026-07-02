# The `core/` engine — the framework-agnostic prompt pipeline

> **Location (flattened 2026-07-02):** this engine lives at **`src/core/`** (repo root). It is **v3-only**
> — the v1/v2 generations and the legacy `<expansion>` stage were removed, so the pipeline is now
> `dynamic-prompt → prompt-salt → list → emphasis → cleanup` (all stages under `src/core/stages/`).

`core/` is the **isomorphic** prompt engine, factored so the same pipeline runs **both** under Node
(`fs` + `createRequire`) and **in the browser** (Vite `import.meta.glob`). It powers the SPA and runs
headless under Node for the test suite and the local `/api` — so there is one engine, not two copies of
the prompt logic.

## Files

| File | Role |
|------|------|
| `core/engine.js` | `createEngine(loader)` → an engine that runs the pipeline over a prompt string. |
| `core/dpl/` | the DPL language — `parser.js`, `renderer.js`, `dpl.js`, `intensity.js`, `words.js`, `rng.js`. |
| `core/stages/dynamicPrompt.js` | `{#name}` generator-expansion stage (factory takes the loader). |
| `core/stages/prompt-salt.js` | `{salt}` randomizer stage. |
| `core/stages/list.js` | `{name}` list stage (factory takes the loader). |
| `core/stages/emphasis.js` | render typed `()`/`[]` emphasis into the active provider dialect. |
| `core/stages/cleanup.js` | collapse stray spaces / commas. |
| `core/listStore.js` | `createListStore(loader)` — per-run list state (once-only depletion, etc.). |
| `core/rng.js` | the seedable `Rng` used for deterministic runs. |
| `core/nodeLoader.js` | Loader impl: filesystem reads + `createRequire` dynamic-prompt loading. |
| `core/browserLoader.js` | Loader impl: Vite `import.meta.glob` bundles the generators; lists ship code-split via `browserCatalogData.js`. |

## The loader seam

The engine never touches files or `require` directly. It calls an injected **loader**:

```
readListLines(name, includeAdult)  -> string[] | null
listNames()                        -> string[]
loadDynamicPrompt(key)             -> { default, full?, suggestion_exclude? } | null
dynamicPromptNames()               -> string[]
```

Two loaders implement that seam — `nodeLoader` (Node) and `browserLoader` (browser) — so only the
file/plugin _access_ is reimplemented per environment. The stages all live together in `core/stages/` and
the `random*` helpers in `src/helpers/`, so there is **no duplicated prompt logic** — the SPA and the
Node runtime share the exact same engine.

## Default pipeline order

```
dynamic-prompt → prompt-salt → list → emphasis → cleanup
```

This is `engine.js`'s `DEFAULT_ORDER`, matching `settings.promptModules` (see [overview.md](overview.md) →
"The prompt pipeline"). `emphasis` runs after `list` so it sees the fully expanded text. The dynamic
prompts are ESM default-export modules in `data/dynamic-prompts/`; `browserLoader` bundles them via glob,
`nodeLoader` `require()`s them.

## Randomness & seeding

Since 2.35.0 the engine is **seedable and deterministic**. `generate({seed})` /
`generateWithSeed()` / `generateMany({seed})` install a seeded `Rng` (`src/core/rng.js`) as the
**ambient** random source (`src/helpers/random.js`) for the run, so the whole pipeline draws from one
reproducible stream; unseeded runs fall back to `Math.random` unchanged. `generateManyAsync` is the
async-capable batch boundary (yields between prompts); the per-prompt render stays synchronous by
design (it also drives the instant live preview). Full detail: [rng-design.md](../reference/rng-design.md).

## Status

The browser path powers the React SPA ([gui.md](gui.md)). The Node path runs the test suite and the
local `/api` runtime, and doubles as **engine verification** (proving the browser and Node produce the
same output). It's also the seam a future CLI would plug into to share this one engine (the classic
Express server it once targeted has since been removed). See
[`../plans/web-migration.md`](../plans/web-migration.md).
