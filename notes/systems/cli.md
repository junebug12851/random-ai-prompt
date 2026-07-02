# The CLI runtime — `index.js`, `common.js`, `src/`, `helpers/`

> **Removed (2026-07-02):** this CLI is not part of the current project — it was the **pre-revival**
> CommonJS system, now removed from the tree (it survives in git history and as a reference clone under
> `assets/references/`). The current project is the SPA + core engine at the repo root; there is no CLI
> yet. This page describes the pre-revival CLI as it was, for historical reference.

The workhorse. `node index.js [...flags]` (npm: `npm start`) parses argv, prepares the run, and drives
the prompt + image loop. Shares its core with the web UI through `common.js`.

## Boot + shared core

Both entry points import `common.js`, whose **first** import is `./chdir.js`
(`process.chdir(import.meta.dirname)`) — so the cwd is pinned to the repo root before any module reads a
cwd-relative file (`./user-settings.json`, `./lists`, `./output`). This ordering is load-bearing; see
[`../reference/esm-patterns.md`](../reference/esm-patterns.md) and the root `CLAUDE.md` "Critical
Things" note. `common.js` exposes the shared `run()`,
`processBatch()`, `upscale()`, and the `settings()` / `userSettings()` accessors.

## `index.js`

- Parses argv (yargs 18).
- Hosts a tiny **progress server** on `serverSettings.portProgress` (7862) exposing
  `/api/images/progress`, so the web UI can poll generation progress.
- Loads optional run data: variation (`src/loadVariationData.js`), reroll (`src/loadRerollData.js`),
  animation (`src/toAnimation.js` / `src/extendAnimation.js`).
- Applies presets + per-flag overrides via `src/applyArgs.js`, then `run()`s.

## `src/` loaders + per-feature logic

| File | Role |
|------|------|
| `loadSettings.js` | Merge defaults ⊕ `user-settings.json` ⊕ legacy migration; strip internal-only fields for `userSettings()`. |
| `createMissingUserSettings.js` / `diffSettings.js` / `convertMetaToJSON.js` | Seed, diff, and convert settings/metadata. |
| `applyArgs.js` | Apply `presets/*.json` then command-line overrides onto the live settings. |
| `genImg.js` | POST to the SD WebUI `txt2img` endpoint (global `fetch`), stream progress into `cli-progress` + `imageSettings.progress*`, save PNG + `.json` sidecar, optionally upscale. |
| `upscaleExisting.js` | Re-run upscale over already-generated images. |
| `loadVariationData.js` / `loadRerollData.js` / `extendAnimation.js` / `toAnimation.js` | Variation, reroll, and animation run modes. |
| `promptFilesAndSuggestions.js` | Scan/classify `dynamic-prompts/` into full vs partial; build `promptSuggestion()`s and the web UI pickers. |

## `helpers/`

`saveImage`, `saveApng` / `makeApng` (APNG stitching via `crc`), `saveResults`, `listFiles`
(default-export object, indexed dynamically — do not flip to named exports), `keywordRepeater` (named
exports — do not flip), `imageUpscaler`, and the `random{Emphasis,Editing,Alternating}` list-randomizers.

## Verification

There is no SD WebUI in CI, so the CLI is verified by **lint + `node --check` + the import smoke test**
(load the whole ESM graph incl. all dynamic prompts via `require(ESM)`, run `promptSuggestion()`, expand
a prompt). Live image generation needs a running WebUI with `--api`. See
[`../plans/testing.md`](../plans/testing.md).
