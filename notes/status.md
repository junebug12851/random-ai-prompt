# Project Status

_Current state only._ For the chronological history of what changed each session and why, see
[`sessions/`](sessions/README.md). For the commit-by-commit changelog see [`version.md`](version.md).

**Version:** `2.5.0` (single source of truth: repo-root `VERSION`; kept in sync with `package.json`;
see [`reference/versioning.md`](reference/versioning.md)).

**Dynamic prompts (2.5.0):** added **pick-one groups** — a category folder with 2+ generators is an implied
group (`{#scene}` runs one random scene generator; `.group` files + markers too), and the same for
expansions (`<lighting>` splices one random expansion). Added the `{#any}` / `{#any-sfw}` / `{#any-nsfw}`
wildcard (one random generator from the whole catalog, `{keyword}`-style mode variants). Reworked the SPA
navbar: **"Full prompts" and "Partial prompts"** tabs with clickable folder-group pills, and **v1/v2
superset links inline next to each tab label** (v2 default). The "pick one"
always resolves to ONE concrete generator/snippet, never a line union.

**Dynamic prompts (2.3.0 + 2.4.0):** `data/dynamic-prompts/` was brought to full parity with the
list/expansion systems. **2.3.0:** the 79 v2 generators (+ the user-submitted one) were reorganized into
category folders under a new `v2/` root (`scene`/`subject`/`fragment`/`style`/`engine`/`user`), `v1/` left
frozen; resolution by **path suffix**, `<name>.json` description sidecars, `_`-internal / `_force-prefix` /
`compareNames`. **2.4.0:** the sigil became **`{#name}`** (brace-delimited like `{list}`/`<expansion>`,
`/`-path capable; bare `#name` retired — 204 internal refs migrated, v1 untouched); automatic NSFW gating
by name token (`isGatedDynPrompt`); tag metadata (`src/dynPromptManifest.js`); and a **uniform SPA** — one
Dynamic-prompts block with category-folder pills
(plain labels — folders are organization, **not** groups: a generator is a script, not a word pool) and a
**v1/v2 toggle**. Only the **new** engine (core loaders/stage, classifier, SPA) was touched — the classic
server + `prompt-modules/` are read-only legacy reference. See
[`reference/dynamic-prompts-architecture.md`](reference/dynamic-prompts-architecture.md).

**Expansions (2.2.0):** `data/expansions/` was brought to parity with the list system — the 9 snippets nest
into category folders (`detail`, `style`, `lighting`, `subject`, `scene`) with shared path-suffix resolution
(existing `<name>` references unchanged), each has a `<name>.json` description sidecar (folders too), and the
SPA token cloud groups them by folder with tooltips. Random-union groups / clickable folder pills / SFW-NSFW
splitting were intentionally left out (they don't fit deterministic copy/paste snippets). See
[`reference/expansions-architecture.md`](reference/expansions-architecture.md).

**Keyword lists (2.1.0, branch `cleanup/list-reorg`):** the `data/lists/` corpus was purged of slurs /
minor-sexualizing / extreme-shock content via a new `src/contentSafety.js` filter (wired into the CSV
build scripts), the 48k-line `keyword.txt` dictionary was sorted by part of speech into `dict-*` lists
(`keyword.txt` is now proper nouns), and duplicated composites were collapsed into **virtual lists**
(`src/listManifest.js`: `danbooru`, `d-keyword`, `d-character`, `artist`, `artist-digipa`, plus new
`danbooru-sfw` and `*-all`). See [`reference/list-architecture.md`](reference/list-architecture.md).

## Current state (read this first)

Everything below happened during the **2026-06-18 revival** (the project had been dormant since
2023-04-07). Four strands, in order:

**1. Modernized to ES modules on Node 24.**

- **Runtime:** Node **24 LTS** (was implicitly an old Node). `.nvmrc` = `24`, `engines.node >= 24`.
- **Module system:** the entire codebase is now **ES modules** (`"type": "module"`). ~130 files moved
  from CommonJS (`require`/`module.exports`) to `import`/`export`. There is no remaining `require`
  except the deliberate `createRequire` used for config-driven synchronous plugin loading (dynamic
  prompts / prompt modules) and the optional legacy `user-settings.js` migration.
- **Dependencies:** all taken to current majors — Express **5**, yargs **18**, open **11**,
  `cli-progress` 3, `crc` 4, `compromise` 14, lodash 4, pug 3. **`node-fetch` was removed** in favor of
  the built-in global `fetch`.
- **Tooling added:** ESLint 9 (flat config) + Prettier 3, plus `.editorconfig`, `.nvmrc`,
  `.prettierrc.json`/`.prettierignore`. `npm` scripts: `start`, `server`/`webui`, `lint`, `lint:fix`,
  `format`, `format:check`.

**2. Reorganized the tree (2.0.1).** All code lives under **`src/`**, all prompt content (lists,
expansions, presets, the CSV sources) under **`data/`**; runtime/user data (`output/`,
`user-settings.json`, `results.json`) stays at the repo root. `src/chdir.js` pins the cwd to the repo
root (its parent) so every cwd-relative path keeps working.

**3. Started the web migration — a React + Vite SPA** (`web-app/`, usable online BYOK or locally). The
real prompt engine was ported to a browser-safe `core/` driven by an **injected loader** (Node: fs +
`createRequire`; browser: Vite `import.meta.glob`), so there is one engine, no duplicated prompt logic.
As of **2.0.2** the SPA front-end is a single **redesigned home page** (`Home.jsx`) styled after the
pre-revival generate screen — dark charcoal + mint brand, Rokkitt/Maven Pro, a hero, and one composer
that unifies prompt building (blocks cloud, share links, custom expansions/presets, chaos,
Normal/Anime toggle, live preview) **and** generation (provider line, generate prompts/images,
in-session gallery). The full settings form lives in a right-side slide-over drawer
(`SettingsDrawer.jsx`). Build tooling is **Vite 8 / @vitejs/plugin-react 6**. The classic Express + Pug
server and the CLI are untouched and still work.

**4. Documented the whole repo in one JSDoc doc-site.** `npm run docs` (`scripts/build-docs.mjs`) builds
a single **JSDoc + docdash** site that unifies the per-function **code API** (every authored `.js`,
including the React SPA via a babel-transpile-then-JSDoc step) with the **entire `notes/` tree as
tutorials** (cross-links rewritten). **Doxygen was retired.** Coverage is complete: `@file` on every
authored file, per-function JSDoc across all server-side code, all 113 dynamic prompts, the frontend
scripts, and the whole `web-app/` SPA — only anonymous callbacks are left (no generator extracts them).
The full AI/notes system (`CLAUDE.md` + `notes/`) backs all of this and is kept living.

**Deployments are intentionally held.** `master` sits at the last pre-revival commit (`241a148`); GitHub
Releases / Pages deploys are paused on purpose because the rewrite is too early to ship. Active work is on
`dev`. See [`reference/deployment.md`](reference/deployment.md).

**Verification done:** `node --check` on all 152 server-side JS files (0 syntax errors); `npm run lint`
(0 errors, 163 pre-existing style warnings); a Prettier pass over the codebase; and an **import smoke
test** that loads the whole ES-module graph, loads all 113 dynamic prompts via `require(ESM)`, runs
`promptSuggestion()`, and expands `#random` — all green.

**Not yet runtime-verified end to end:** actually generating an image requires a running Stable
Diffusion WebUI (`--api`) on `imageSettings.url`; that wasn't exercised here. The CLI (`index.js`) and
server (`server.js`) entry points pass syntax + import-graph validation and use Express-5-safe route
patterns, but were not launched live (launching the server opens a browser on the user's machine).

## Open issues

| Issue | Where | Status / notes |
|-------|-------|----------------|
| No automated test suite | whole repo | Verification is lint + `node --check` + the import smoke test. A real suite is a future task — see [`plans/testing.md`](plans/testing.md). |
| `no-dupe-else-if` warnings (dead branches) | several `dynamic-prompts/**.js` (e.g. `v2/subject/portrait-princess.js`, `v1/*`) | Pre-existing duplicate `else if` conditions flag as ESLint warnings. They likely indicate latent logic bugs in the prompt generators, but "fixing" them changes generated prompts, so they're left as warnings to review deliberately. See [`plans/next-steps.md`](plans/next-steps.md). |
| `no-useless-escape` warnings | a few prompt/data regexes | Harmless redundant escapes; kept as warnings (changing regexes risks changing output). |
| Live generation unverified | `src/genImg.js`, `helpers/imageUpscaler.js`, `server.js` | Needs a running SD WebUI to confirm the `fetch` migration end to end. |

## Build / run health

| Area | Status |
|------|--------|
| `npm install` (Node 24) | ✅ resolves clean |
| `node --check` all JS | ✅ 0 syntax errors (152 files) |
| `npm run lint` | ✅ 0 errors (165 warnings, pre-existing; ESLint 10) |
| Import smoke test (full graph + dynamic prompts + expansion) | ✅ green |
| `npm run docs` (JSDoc + docdash doc-site, ~244 pages) | ✅ exit 0 |
| `web-app` SPA `vite build` | ✅ green |
| CLI `node index.js` | ⚠️ imports validated; live run needs SD WebUI |
| Server `node server.js` | ⚠️ imports + Express 5 routes validated; not launched live |
