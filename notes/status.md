# Project Status

_Current state only._ For the chronological history of what changed each session and why, see
[`sessions/`](sessions/README.md). For the commit-by-commit changelog see [`version.md`](version.md).

**Version:** `2.0.1` (single source of truth: repo-root `VERSION`; kept in sync with `package.json`;
see [`reference/versioning.md`](reference/versioning.md)).

## Current state (read this first)

The project was just **modernized** (2026-06-18):

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
- **The full AI/notes system** (`CLAUDE.md` + `notes/`) was set up, modeled on a sibling project.

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
| CLI `node index.js` | ⚠️ imports validated; live run needs SD WebUI |
| Server `node server.js` | ⚠️ imports + Express 5 routes validated; not launched live |
