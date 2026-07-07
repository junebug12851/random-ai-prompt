# System Map {#rap_systems_about}

> **Structure note (flattened 2026-07-02):** one project at the **repo root** — the core engine + SPA
> (v3-only, no expansions). The `cli`/`server` deep-dives describe the **pre-revival** system, now removed
> from the tree (kept in git history + a reference clone under `assets/references/`); `core-engine`/`gui`
> describe the current app.

A structured account of how random-ai-prompt is built — the macro picture and the per-layer
deep-dives. This is the "understand the whole machine" reference; it grows alongside the code.

All code lives under **`src/`** (the `core/` engine, its loaders, `helpers/`, and the list/safety/manifest
modules); all prompt content lives under **`data/`** (`lists/`, `presets/`, the CSV `sources/`, and
`blocks/` — the `{#name}` generators are executable `.js` but are treated as content, the one
deliberate `src/`→`data/` exception); the React/Vite SPA is **`targets/web/`**; runtime/user data (`output/`,
`user-settings.json`, `results.json`) stays at the repo root.

Read in this order:

| Doc | Scope |
|-----|-------|
| [overview.md](overview.md) | **Start here.** The macro picture: the surfaces (the SPA + the local `/api` + the engine under Node), one engine / two loaders, the prompt pipeline, image generation via provider adapters, and settings as the spine. |
| [core-engine.md](core-engine.md) | The isomorphic `core/` engine — `engine.js`, the `stages/` (block / prompt-salt / list / emphasis / cleanup), `listStore`, and the `node`/`browser` loaders that let the same prompt logic run under Node and in the browser. |
| [gui.md](gui.md) | The standalone React + Vite SPA in `targets/web/` — the ~40-provider BYOK model, the browser prompt engine, the in-app Manager, and the two editions (local + online). |
| [desktop.md](desktop.md) | The pre-built **desktop edition** — a thin Tauri (Rust) shell that runs the unmodified local SPA + Node `/api` backend as a bundled sidecar, plus the staging step and the per-OS installer/portable build. |
| [cli.md](cli.md) | The **CLI target** (`targets/cli/`, the `rap` tool, 2.50.0): a traditional args + flags command-line target that reuses the engine + providers + settings store at parity with the GUI, with multi-shell completion. (Also notes the removed pre-revival CLI.) |
| [server.md](server.md) | **Historical.** The pre-revival Express/Pug web UI + its self-healing image index, now removed from the tree — kept as a record of the classic server. |

How this relates to the other notes:

- [../context/architecture.md](../context/architecture.md) is the quick orientation; this folder is the
  in-depth version.
- [../decisions/architecture.md](../decisions/architecture.md) explains *why* key structures are the way
  they are.
- [../reference/esm-patterns.md](../reference/esm-patterns.md) holds the Node/ESM mechanics
  (`createRequire`-driven plugin loading, `chdir` ordering) referenced throughout.

> Some per-layer docs are deliberately concise and **grow as each layer is studied in depth** — same
> as the macro overview, the goal is that nothing about how a layer works is trapped in one head.
