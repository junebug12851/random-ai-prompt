# The `core/` engine — the framework-agnostic prompt pipeline

`core/` is the **isomorphic** prompt engine: the same prompt-module pipeline as the Node CLI, factored
so it runs **both** server-side (Node `fs` + `createRequire`) and **in the browser** (Vite
`import.meta.glob`). It exists for the web migration — see [`../plans/web-migration.md`](../plans/web-migration.md)
— so there is one engine, not two copies of the prompt logic.

## Files

| File | Role |
|------|------|
| `core/engine.js` | `createEngine(loader)` → an engine that runs the pipeline over a prompt string. |
| `core/stages/dynamicPrompt.js` | `#name` expansion stage (factory takes the loader). |
| `core/stages/expansion.js` | `<name>` expansion stage. |
| `core/stages/list.js` | `{name}` list stage. |
| `core/listStore.js` | `createListStore(loader)` — per-run list state (once-only depletion, etc.). |
| `core/nodeLoader.js` | Loader impl: filesystem reads + `createRequire` dynamic-prompt loading. |
| `core/browserLoader.js` | Loader impl: Vite `import.meta.glob` bundles prompts/lists/expansions/presets at build time. |

## The loader seam

The engine never touches files or `require` directly. It calls an injected **loader**:

```
readExpansion(name)     -> string | null
readListLines(name)     -> string[] | null
listNames()             -> string[]
loadDynamicPrompt(key)  -> { default, full?, suggestion_exclude? } | null
```

Two loaders implement that seam — `nodeLoader` (server) and `browserLoader` (SPA) — so only the
file/plugin *access* is reimplemented per environment. The **pure** stages (`prompt-salt`, `cleanup`)
and the `random*` helpers are imported and reused directly from `prompt-modules/` and `helpers/`, so
there is **no duplicated prompt logic** between this engine and the CLI's `processBatch()`.

## Default pipeline order

```
expansion → dynamic-prompt → expansion → dynamic-prompt → prompt-salt → list → cleanup
```

Identical to the CLI's `settings.promptModules` order (see [overview.md](overview.md) → "The
prompt-module pipeline"). The dynamic prompts are the same ESM default-export modules in
`dynamic-prompts/` the CLI uses; `browserLoader` bundles them via glob, `nodeLoader` `require()`s them.

## Status

The browser path powers the React SPA ([web-app.md](web-app.md)). The Node path is used today for
**engine verification** (proving the browser and server produce the same output) and is the route by
which the CLI will share this engine when Express is retired (migration phase 5). See
[`../plans/web-migration.md`](../plans/web-migration.md).
