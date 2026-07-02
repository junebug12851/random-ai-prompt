# Architecture

> **Structure note (flattened 2026-07-02):** the project lives at the **repo root** (`src/`, `data/`,
> `gui/`, `scripts/`, `tests/`); run everything from there. The old single-entry CLI + classic Express/Pug
> server described in places below were the **pre-revival** system, now removed from the tree (it survives
> in git history and as a reference clone under `assets/references/`).

ES modules (`"type": "module"`), Node 24. **All code lives under `src/`; all prompt content (data)
lives under `data/`.** The one deliberate exception is `data/dynamic-prompts/` — the `#name`
generators are executable `.js` but are treated as prompt *content* (authored like lists/expansions),
so they live with the rest of the content under `data/`. Everything runs with the current working
directory pinned to the project root by
`src/chdir.js` (which `chdir`s to its parent), so the many `./output`, `./data/lists`, `./results.json`
style paths resolve from the root regardless of where `node` was launched.

## Top-level layout

```
src/                ALL code
  index.js          CLI entry — parses args, runs generation, also hosts the progress server
  server.js         Web UI entry — Express + Pug app, shells out to the CLI to generate
  common.js         Shared core — argv, settings accessors, run()/processBatch()/upscale()
  chdir.js          Side-effect module: process.chdir(parent of src) = repo root. Imported first.
  settings.js / image-settings.js / upscale-settings.js / server-settings.js   Default settings objects
  loadSettings.js          merge defaults + user-settings.json (+ legacy migration)
  createMissingUserSettings.js / diffSettings.js / convertMetaToJSON.js
  applyArgs.js             apply presets + command-line overrides
  genImg.js                call SD WebUI txt2img + progress bars (uses global fetch)
  loadVariationData.js / loadRerollData.js / upscaleExisting.js / extendAnimation.js / toAnimation.js
  promptFilesAndSuggestions.js   scan/classify dynamic prompts, build suggestions
  prompt-modules/   The prompt pipeline stages
    dynamic-prompt.js  expand #name tokens (loads data/dynamic-prompts/* via createRequire)
    expansion.js       expand <name> tokens   list.js  expand {name} tokens
    prompt-salt.js     {salt} handling        cleanup.js  whitespace/comma cleanup
  helpers/          saveImage, saveApng, makeApng, saveResults, listFiles, keywordRepeater,
                    imageUpscaler, randomEmphasis/Editing/Alternating
  core/             the isomorphic engine (engine.js, stages/, node/browserLoader) — see systems/core-engine.md
  web/              backend/indexImages.js (image index) + frontend/ (browser JS/CSS) + views/ (Pug)

data/               ALL prompt content
  lists/  presets/   data files for {name} and presets
  dynamic-prompts/  flat <category>/ {#name} generators (.dpl + optional .js): export default fn (+ export const full / suggestion_exclude)
  sources/   raw build inputs (artists.csv, danbooru.csv, nai-tag-expirement.json)
  process-*.js      one-off scripts that build the lists/ files from the data/sources/ CSV/JSON

default-user-settings.json   Seed for the user's user-settings.json (root)
output/             generated images + their .json metadata (root, gitignored)
user-settings.json / results.json   runtime user data (root, gitignored)
```

The directory names code consumes are centralized in `src/settings.js` (`listFiles: "./data/lists"`,
`expansionFiles: "./data/expansions"`, `presetFiles: "./data/presets"`; `dynamicPromptFiles:
"dynamic-prompts"` now resolves under `data/` — the loaders prefix it with `../../data/` (legacy
`prompt-modules/dynamic-prompt.js`) or `data/` (`core/nodeLoader.js`); `promptModuleFiles` stays
relative to `src/`). The web UI's served folder is `serverSettings.webFolder` = `"./src/web"`.

## Data flow — CLI generate

`node . ...` → `common.js` loads settings → `index.js` listens on the progress port, applies
variation/reroll/animation loaders and `applyArgs` → `run()` → for each prompt, `processBatch()` runs
`settings.promptModules` over the prompt string (expanding `#`/`{}`/`<>`, salt, cleanup) → if images are
enabled and mode is StableDiffusion, `src/genImg.js` POSTs to the WebUI `txt2img` API, saves PNG + JSON
via `src/helpers/saveImage.js`, optionally upscales (`src/helpers/imageUpscaler.js`) → results written to
`results.json` and (for animations) an APNG.

## Data flow — Web UI

`node src/server.js` builds the image index (`src/web/backend/indexImages.js` scans `output/*.json`), starts
Express on `server-settings.port` (7861), opens the browser, and serves the Pug pages + a JSON API.
Generation requests (`/api/generate`, `/api/file-variation/:id`, `/api/upscale-file/:id`, …) set args
and **spawn the CLI** (`node . --flags`) via `child_process`; progress is read by polling the CLI's
progress server. The index supports keyword search, a feed, stats, and per-image detail.

## The settings accessor pattern

Modules don't import the mutable settings object directly; they call `settings()` (from
`loadSettings.js`, re-exported by `common.js`) which returns the current merged object. This lets the
server reload/replace settings at runtime (`/api/reload-settings`, `/api/replace-settings`).

See [`../systems/overview.md`](../systems/overview.md) for the deeper walk-through and
[`../reference/esm-patterns.md`](../reference/esm-patterns.md) for the module-wiring rules.
