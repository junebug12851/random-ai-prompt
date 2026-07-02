# Architecture

ES modules (`"type": "module"`), Node 24. **One project at the repo root.** All engine code lives under
`src/`; all prompt _content_ lives under `data/`; the React/Vite web app is `gui/` (its own npm package).
The one deliberate exception to "code lives in `src/`" is `data/dynamic-prompts/` — the `{#name}`
generators are executable `.js` but are authored as prompt content (like lists), so they live under
`data/`.

> The pre-revival 2022–2023 system (a yargs CLI + an Express/Pug web UI, with a `common.js` / `chdir.js`
> core) was removed from the tree; it survives in git history and as a reference clone under
> `assets/references/`. A sibling **CLI** is planned but not built yet — today the only front end is the
> `gui/` SPA.

## Top-level layout

```
src/                the isomorphic prompt engine (no framework deps)
  core/
    engine.js         engine entry: createEngine(), generate/generateMany(+Async), seeding
    dpl/              the DPL language — parser.js, renderer.js, dpl.js, intensity.js, words.js, rng.js
    stages/           pipeline stages — dynamicPrompt.js, prompt-salt.js, list.js, emphasis.js, cleanup.js
    nodeLoader.js     Node content loader (fs + createRequire), resolved module-relative to the repo root
    browserLoader.js  browser content loader (Vite import.meta.glob) + browserCatalogData.js
    listStore.js      list-corpus access + SFW/NSFW gating;  rng.js  the seedable RNG
  promptFilesAndSuggestions.js   scan/classify dynamic prompts, build suggestions
  settings.js                     default settings (pipeline order, content paths, dialect, gating, …)
  listResolve.js / listTags.js / nameOrder.js / listManifest.js   list resolution + metadata + virtual lists
  dynPromptManifest.js            dynamic-prompt tag metadata
  contentSafety.js / safetyLexicons.js / gatedLists.js   content-safety filter + NSFW gating
  helpers/          random.js, keywordRepeater.js, aliases.js, randomEmphasis/Editing/Alternating.js

data/               all prompt content
  lists/            {name} word lists (by category)
  presets/          saved settings presets
  dynamic-prompts/  flat <category>/ {#name} generators (.dpl / .js + optional .json description sidecar)
  sources/          raw build inputs (artists.csv, danbooru.csv, nai-tag-expirement.json)
  manifest.json     published content manifest (backs the Manager's ghost-pill diff)
  process-*.js      manual build scripts: turn data/sources/ CSV/JSON into lists/ files

gui/                the React 19 + Vite SPA (its own package.json)
  src/              components/, lib/ (promptEngine, runtimeLoader, dpl, providers, …), i18n/, styles/, theme/
  providers/        ~40 image/text provider adapters (_shared/ transport + one folder per provider)
  server/           the local /api backend (apiHandler.js, manageFs.js, serve.js) — LOCAL edition only
  storage/          local-file storage backend (dev/desktop)
  public/           self-hosted fonts/ + the legal/ pages
  tests/            the jsdom (Vitest) SPA suite

scripts/            build/meta tooling (build-docs, build-data-manifest, smoke-test, dpl-*, list-cleanup, …)
tests/              the Node (Vitest) suite — unit/integration/snapshot/regression + e2e/ (Playwright)
notes/  assets/     the developer guide + icons / references / docs-theme
output/  user-settings.json  results.json   runtime/user data (repo root, gitignored)
```

## One engine, two loaders (isomorphic)

The engine in `src/core/` has no filesystem or framework dependency. Content — the lists and the
dynamic-prompt generators — is supplied by an **injected loader**:

- **Node** (`nodeLoader.js`) — reads from disk with `fs` and loads `.js` generators synchronously via
  `createRequire(import.meta.url)`. It resolves the content root **module-relative**
  (`fileURLToPath(new URL("../../", import.meta.url))` → the repo root), so it does not depend on the cwd.
- **Browser** (`browserLoader.js`) — a Vite `import.meta.glob("../../data/dynamic-prompts/**/*.js")`
  build-time macro bundles every generator; the lists ship as a code-split data module
  (`browserCatalogData.js`).

So there is one engine and no duplicated prompt logic: the same pipeline runs under Node (the test suite,
the local `/api`) and in the browser (the SPA).

## The prompt pipeline

`settings.promptModules` = `["dynamic-prompt", "prompt-salt", "list", "emphasis", "cleanup"]`, run in
order on each prompt string (the stages live in `src/core/stages/`):

1. **dynamic-prompt** — expand `{#name}` generators (re-expanding nested tokens up to ~10 passes),
   honoring the per-token intensity / focus dials.
2. **prompt-salt** — the optional `{salt}` randomizer.
3. **list** — expand `{name}` list tokens.
4. **emphasis** — render typed `()` / `[]` emphasis into the active provider dialect (SD/MJ weights, NAI
   braces, or plain words).
5. **cleanup** — tidy stray spaces / commas.

The DPL parser + renderer (`src/core/dpl/`) is what the stages call to compile and roll a template. The
engine is **deterministic and seedable** (`src/core/rng.js`), so the same seed reproduces a result.

## One code pool, two editions

The same code builds two editions, gated at build time by `VITE_ONLINE`:

- **Local / desktop** (full) — Gallery, Single view, the in-app content **Manager**, the local
  Stable-Diffusion providers, and NSFW. It ships a small Node server (`gui/server/serve.js`) that serves
  the built SPA **plus** the `/api/*` backend (`gui/server/apiHandler.js`: image save + feed, the
  Manager's on-disk file ops via `manageFs.js`, ImageMagick convert, …).
- **Online** (`prompt.fairyfox.io`) — a browser-only static build. **No server:** BYOK provider calls go
  straight from the browser to the chosen provider; providers that can't be called from a browser are
  disabled, and the local-only features (Gallery / Single / Manage, NSFW) are gated off. The online build
  also **prerenders** its first paint (SSR of `entry-server.jsx` → `renderToString` → hydrate), so the
  initial render must be SSR-safe (no `window` / `document` access during render).

Each edition has the usual **dev** stage (`npm run web` — the Vite dev server, which mounts the same
`/api` handler through `gui/vite-plugin-api.js`) and **release** stage.

## Data flow — generate

The SPA composes a **DPL prompt** in the editor → `gui/src/lib/promptEngine.js` drives the engine
(`createEngine` + the browser loader) to expand it into the final prompt(s), deterministically and
seedably → for **text** generation the prompt is returned as-is or rewritten by a text AI; for **images**
the chosen provider adapter (`gui/providers/<id>/`) is called **directly from the browser** with the
user's BYOK key (there is no server relay). In the **local** edition, each generated image plus a `.json`
metadata sidecar (the prompt layers, the deterministic engine roll, the provider, and a key-stripped
settings snapshot) is written to `output/` via `POST /api/image` and browsed through `GET /api/feed`.

## Settings & content paths

`src/settings.js` is the default settings object — the pipeline order (`promptModules`), the content
locations, the active dialect, gating, and so on. Content paths resolve two ways: the dynamic-prompt
loaders are **module-relative** (cwd-independent), while the list/preset settings
(`listFiles: "./data/lists"`, `presetFiles: "./data/presets"`) are **cwd-relative** — so everything is
run from the repo root (npm scripts always are; there is no `chdir` shim). User overrides live in
`user-settings.json` (local) or `localStorage` (browser), merged over the defaults.

See [`../systems/overview.md`](../systems/overview.md) for the deeper walk-through, and the per-layer
deep-dives under [`../systems/`](../systems/README.md).
