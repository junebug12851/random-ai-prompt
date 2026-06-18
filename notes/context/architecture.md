# Architecture

ES modules (`"type": "module"`), Node 24. Everything runs with the current working directory pinned to
the project root by `chdir.js`, so the many `./output`, `./lists`, `./results.json` style paths resolve.

## Top-level layout

```
index.js            CLI entry — parses args, runs generation, also hosts the progress server
server.js           Web UI entry — Express + Pug app, shells out to the CLI to generate
common.js           Shared core — argv, settings accessors, run()/processBatch()/upscale()
chdir.js            Side-effect module: process.chdir(import.meta.dirname). Imported first.

settings.js / image-settings.js / upscale-settings.js / server-settings.js
                    Default settings objects (export default {...})
default-user-settings.json   Seed for the user's user-settings.json

src/                Loaders + per-feature logic
  loadSettings.js          merge defaults + user-settings.json (+ legacy migration)
  createMissingUserSettings.js / diffSettings.js / convertMetaToJSON.js
  applyArgs.js             apply presets + command-line overrides
  genImg.js                call SD WebUI txt2img + progress bars (uses global fetch)
  loadVariationData.js / loadRerollData.js / upscaleExisting.js / extendAnimation.js / toAnimation.js
  promptFilesAndSuggestions.js   scan/classify dynamic prompts, build suggestions

prompt-modules/     The prompt pipeline stages
  dynamic-prompt.js  expand #name tokens (loads dynamic-prompts/* via createRequire)
  expansion.js       expand <name> tokens   list.js  expand {name} tokens
  prompt-salt.js     {salt} handling        cleanup.js  whitespace/comma cleanup

dynamic-prompts/    ~113 plugin modules: export default fn (+ export const full / suggestion_exclude)
  v1/  user-submitted/   variant sets
lists/  expansions/  presets/   data files for {name}, <name>, and presets
helpers/            saveImage, saveApng, makeApng, saveResults, listFiles, keywordRepeater,
                    imageUpscaler, randomEmphasis/Editing/Alternating
data/               one-off scripts that build the lists/ files from CSV/JSON sources

web/                backend/indexImages.js (the image search index) + frontend/ (browser JS/CSS) +
                    views/ (Pug templates)
output/             generated images + their .json metadata (gitignored)
```

## Data flow — CLI generate

`node . ...` → `common.js` loads settings → `index.js` listens on the progress port, applies
variation/reroll/animation loaders and `applyArgs` → `run()` → for each prompt, `processBatch()` runs
`settings.promptModules` over the prompt string (expanding `#`/`{}`/`<>`, salt, cleanup) → if images are
enabled and mode is StableDiffusion, `genImg.js` POSTs to the WebUI `txt2img` API, saves PNG + JSON via
`helpers/saveImage.js`, optionally upscales (`helpers/imageUpscaler.js`) → results written to
`results.json` and (for animations) an APNG.

## Data flow — Web UI

`node server.js` builds the image index (`web/backend/indexImages.js` scans `output/*.json`), starts
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
