# System Map — Overview

> **Structure note (flattened 2026-07-02):** one project at the **repo root** — the core engine + React
> SPA. The CLI/server sections below describe the **pre-revival** system, now removed from the tree (kept
> in git history + a reference clone under `assets/references/`). The current app is **v3-only** and the
> legacy `<expansion>` mechanism was removed.

A deeper walk-through of how the machine fits together. For the quick orientation see
[`../context/architecture.md`](../context/architecture.md); for module-wiring rules see
[`../reference/esm-patterns.md`](../reference/esm-patterns.md).

This is the **macro** picture. Per-layer deep-dives live alongside it (see [README.md](README.md)):
[core-engine.md](core-engine.md), [cli.md](cli.md), [server.md](server.md), [gui.md](gui.md).

## The three runtimes

There are really three processes:

1. **CLI generate** (`src/index.js`) — the workhorse. Parses argv, optionally loads variation/reroll/
   animation data, applies presets + arg overrides, then `run()`s the prompt+image loop. It also hosts
   a tiny **progress server** on `serverSettings.portProgress` (7862) exposing `/api/images/progress`.
2. **Web UI** (`src/server.js`) — Express on `serverSettings.port` (7861). Serves Pug pages + a JSON API
   + the `output/` images, and **spawns the CLI** for any actual generation. It reads generation
   progress by HTTP-polling the CLI's progress server, and merges that with its own `execAppOngoing` flag.
3. **The browser** — `src/web/frontend/*` (jQuery-era classic scripts) talking to that JSON API.

`src/common.js` is imported by both `src/index.js` and `src/server.js` and is where the shared `run()`,
`processBatch()`, `upscale()`, and the settings accessors live.

## Boot order (and why `chdir.js` is first)

Both entry points ultimately import `src/common.js`, whose **first** import is `./chdir.js`
(`src/chdir.js`, which does `process.chdir(path.join(import.meta.dirname, ".."))` — pinning cwd to the
**repo root**, since the code now lives under `src/`). This matters because ES-module imports are
evaluated in source order *before* any top-level statement runs: `loadSettings.js` reads
`./user-settings.json` at import time, so the chdir has to happen via an earlier-imported module, not via
an inline statement in `common.js`. After chdir, `loadSettings.js` builds the merged settings (defaults
⊕ user-settings ⊕ legacy migration), and `common.js` exposes `settings()` returning the live object.

## The prompt-module pipeline

`processBatch()` takes `settings.prompt` and runs it through `settings.promptModules` in order. Each
named module is a file in `src/prompt-modules/`, loaded by config-driven path:

```
prompt → expansion → dynamic-prompt → expansion → dynamic-prompt → prompt-salt → list → cleanup
```

- **expansion** (`<name>`): splice in `data/expansions/name.txt`.
- **dynamic-prompt** (`#name`): expand by calling `data/dynamic-prompts/name.js`'s default export.
  Supports nesting (re-runs up to 10x), `-v1` variants (`data/dynamic-prompts/v1/`), `user-` prefixed
  user-submitted prompts, and auto-appended `#fx` / `#artists`. Danbooru keyword substitution is applied.
- **prompt-salt** (`{salt}`): inject a random or incrementing number (a subseed alternative).
- **list** (`{name}`): pull a random line from `data/lists/name.txt`, with emphasis/editing/alternating
  randomization (`src/helpers/randomEmphasis|Editing|Alternating.js`) and once-only depletion.
- **cleanup**: collapse stray spaces/commas.

The data directories code consumes are set in `src/settings.js` (`listFiles: "./data/lists"`,
`expansionFiles: "./data/expansions"`, `presetFiles: "./data/presets"`); `dynamicPromptFiles` /
`promptModuleFiles` stay relative to `src/`.

Two loaders make this work synchronously: `src/prompt-modules/dynamic-prompt.js` and `src/common.js` both use
`createRequire(import.meta.url)` to `require()` the ES-module plugins (Node 24 allows this) and call
`.default(...)`. See [`../reference/esm-patterns.md`](../reference/esm-patterns.md).

## Dynamic-prompt classification

`src/promptFilesAndSuggestions.js` scans `data/dynamic-prompts/` (+ `v1/`, `user-submitted/`) and splits the
files into **full** vs **partial** prompts by reading each module's `full` export, excluding ones with
`suggestion_exclude`. It uses these to build random `promptSuggestion()`s and to populate the web UI's
file pickers. The scan loads each module via the same `createRequire` mechanism.

## Image generation + the index

`src/genImg.js` POSTs to the WebUI `txt2img` endpoint (global `fetch`), streams progress into
`cli-progress` bars and into `imageSettings.progress*`, then saves each PNG + a `.json` metadata sidecar
(`src/helpers/saveImage.js`) and optionally upscales (`src/helpers/imageUpscaler.js`). Animations are
stitched into an APNG (`src/helpers/makeApng.js`, using `crc`).

`src/web/backend/indexImages.js` builds an in-memory index from every `output/*.json`: a keyword→files map
(via `compromise`/lodash tokenization), per-image data, deep links (upscales/variations/rerolls/
animation frames), and stats. The web API queries this index. It self-heals: invalid deep links and
orphaned upscales are pruned and the affected `.json` files minimally rewritten, re-indexing up to 5x.

## Settings as the spine

Everything reads from the merged settings via `settings()`. The web UI can mutate it at runtime
(`/api/setting`, `/api/merge-settings`, `/api/replace-settings`, `/api/reload-settings`) and persist the
diff to `user-settings.json`. The CLI applies presets (`data/presets/*.json`) and per-flag overrides through
`src/applyArgs.js`. Internal-only fields (progress, lastCmd, animation bookkeeping) are stripped before
writing user settings (`userSettings()` in `loadSettings.js`).
