# Project Status

_Current state only._ For the chronological history of what changed each session and why, see
[`sessions/`](sessions/README.md). For the commit-by-commit changelog see [`version.md`](version.md).

**Version:** `2.0.1` (single source of truth: repo-root `VERSION`; kept in sync with `package.json`;
see [`reference/versioning.md`](reference/versioning.md)).

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
The SPA has a Settings editor, a Prompt **Build**er (blocks cloud, share links, custom
expansions/presets, chaos), and a Generate gallery — though **only the Build tab is currently shown**
while the rest of the UI is reworked. Build tooling is **Vite 8 / @vitejs/plugin-react 6**. The classic
Express + Pug server and the CLI are untouched and still work.

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
| `no-dupe-else-if` warnings (dead branches) | several `dynamic-prompts/*.js` (e.g. `portrait-princess.js`, `v1/*`) | Pre-existing duplicate `else if` conditions flag as ESLint warnings. They likely indicate latent logic bugs in the prompt generators, but "fixing" them changes generated prompts, so they're left as warnings to review deliberately. See [`plans/next-steps.md`](plans/next-steps.md). |
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
