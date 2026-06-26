# What This Project Is

> **Update (2026-06-25):** the active project is now **`engine-v3/`** — the prompt engine + React SPA. The
> CLI, classic Express/Pug server, animations, variations/re-rolls/upscales, and expansions described below
> are the **pre-revival** system, preserved frozen in **`engine-v1-2/`** (on its way out). engine-v3 is
> v3-only with no expansions. See [`../plans/engine-split.md`](../plans/engine-split.md).

**random-ai-prompt** is a Node.js tool that **generates random/dynamic text prompts for AI image
generation** and (optionally) drives the **Stable Diffusion WebUI** API to turn those prompts into
images, animations, variations, re-rolls, and upscales.

It has two faces over one shared core:

- **CLI** (`index.js`, `npm start`) — `node . [options]`. Generates prompts and images from the command
  line, applying presets and command-line overrides.
- **Web UI** (`server.js`, `npm run server` / `webui.bat`) — an Express + Pug app on
  `http://localhost:7861` with a feed of generated images, a search index, a settings editor, prompt
  suggestions, and controls to generate/vary/re-roll/upscale/animate. It shells out to the CLI to do
  the actual generation and polls a small progress server.

## The core idea: prompts as a small language

A prompt is a string with expandable tokens that a **prompt-module pipeline** rewrites:

- `#name` — a **dynamic prompt**: a JS module in `dynamic-prompts/` that returns a generated fragment
  (e.g. `#random`, `#beach`, `#artists`, `#fx`). They can nest and there are `v1/` and `user-submitted/`
  variants.
- `{name}` — a **list**: a random line pulled from `lists/name.txt` (e.g. `{keyword}`, `{artist}`).
- `<name>` — an **expansion**: the contents of `expansions/name.txt` spliced in.
- Plus randomized emphasis/de-emphasis, editing, alternating, prompt "salt", and cleanup passes.

The pipeline order lives in `settings.promptModules`
(`["expansion", "dynamic-prompt", "expansion", "dynamic-prompt", "prompt-salt", "list", "cleanup"]`).

## Settings model

Four default settings objects — `settings.js`, `image-settings.js`, `upscale-settings.js`,
`server-settings.js` — are deep-merged with the user's `user-settings.json` (auto-created from
`default-user-settings.json`). Command-line args and presets override on top. `src/loadSettings.js`
owns this; `userSettings()` writes back only the diff from defaults.

## Goals / non-goals

- **Goal:** make it fun and fast to explore a huge space of image prompts with minimal typing, and to
  manage/search the resulting images locally.
- **Goal:** keep prompts data-driven and easy to extend (drop a file in `dynamic-prompts/`, `lists/`,
  `expansions/`, or `presets/`).
- **Non-goal:** it is not an image model itself — it orchestrates the Stable Diffusion WebUI's `--api`.
- **Non-goal:** no cloud service; everything runs locally against the user's own WebUI and writes to
  `./output`.
