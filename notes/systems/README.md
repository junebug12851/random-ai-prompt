# System Map {#rap_systems_about}

> **Structure note (flattened 2026-07-02):** one project at the **repo root** — the core engine + SPA
> (v3-only, no expansions). The `cli`/`server` deep-dives describe the **pre-revival** system, now removed
> from the tree (kept in git history + a reference clone under `assets/references/`); `core-engine`/`gui`
> describe the current app.

A structured account of how random-ai-prompt is built — the macro picture and the per-layer
deep-dives. This is the "understand the whole machine" reference; it grows alongside the code.

> **Layout (June 2026 reorg):** all code lives under **`src/`** (entry points, settings, loaders,
> `helpers/`, `core/`, `prompt-modules/`, `web/`); all prompt content lives under
> **`data/`** (`lists/`, `expansions/`, `presets/`, the CSV sources, and `dynamic-prompts/` — the
> `#name` generators are executable `.js` but are treated as content, the one deliberate `src/`→`data/`
> exception); runtime/user data (`output/`, `user-settings.json`, `results.json`) stays at the repo
> root. Where a doc below names a bare path like `prompt-modules/` or `lists/`, read it as
> `src/prompt-modules/` / `data/lists/` accordingly, and `dynamic-prompts/` as `data/dynamic-prompts/`.

Read in this order:

| Doc | Scope |
|-----|-------|
| [overview.md](overview.md) | **Start here.** The macro picture: the three runtimes (CLI / web UI / browser), boot order and why `chdir.js` is first, the prompt-module pipeline, image generation + the index, and settings as the spine. |
| [core-engine.md](core-engine.md) | The isomorphic `core/` engine — `engine.js`, the `stages/` (dynamicPrompt / expansion / list), `listStore`, and the `node`/`browser` loaders that let the same prompt logic run server-side and in the browser. |
| [cli.md](cli.md) | The CLI runtime: `index.js` + `common.js`'s `run()`/`processBatch()`/`upscale()`, the `src/` loaders, `applyArgs`, image generation (`src/genImg.js`), and the `helpers/`. |
| [server.md](server.md) | The web UI: `server.js` (Express 5 + Pug), the JSON API, the `web/frontend/` classic-JS client, and `web/backend/indexImages.js` (the self-healing image index). |
| [gui.md](gui.md) | The standalone React + Vite SPA in `gui/` — the BYOK provider model (`localWebui` / `hostedProxy`), the browser prompt engine, and the Netlify function. |

How this relates to the other notes:

- [../context/architecture.md](../context/architecture.md) is the quick orientation; this folder is the
  in-depth version.
- [../decisions/architecture.md](../decisions/architecture.md) explains *why* key structures are the way
  they are.
- [../reference/esm-patterns.md](../reference/esm-patterns.md) holds the Node/ESM mechanics
  (`createRequire`-driven plugin loading, `chdir` ordering) referenced throughout.

> Some per-layer docs are deliberately concise and **grow as each layer is studied in depth** — same
> as the macro overview, the goal is that nothing about how a layer works is trapped in one head.
