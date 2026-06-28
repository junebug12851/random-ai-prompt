# Dependencies

Current as of the 2.0.0 modernization (2026-06-18). Node **24 LTS**. Keep this in sync when you add,
remove, or bump a dependency.

## Runtime dependencies

| Package | Major | Used by | Notes |
|---------|-------|---------|-------|
| `express` | **5** | `server.js`, progress server in `index.js` | v5 uses a newer path-to-regexp. The routes here are all simple (`:param`, static mounts, `res.jsonp/render/download/json`) and v5-safe. If adding routes, avoid bare `*` and regex strings. |
| `yargs` | **18** | `common.js` | ESM-first. `import yargs from "yargs"` + `import { hideBin } from "yargs/helpers"`. `.argv` still works. |
| `open` | **11** | `server.js` | ESM-only; `import open from "open"`. Opens the browser to the UI on server start. |
| `lodash` | 4 | many | CJS; default import works (`import _ from "lodash"`). |
| `compromise` | 14 | `web/backend/indexImages.js` | NLP tokenization for the keyword index. Default import. |
| `crc` | 4 | `helpers/makeApng.js` | `import crc from "crc"; crc.crc32(...)`. |
| `cli-progress` | 3 | `src/genImg.js`, `indexImages.js` | Default import; `new cliProgress.SingleBar/MultiBar(...)`. |
| `pug` | 3 | `server.js` (view engine) | Templates in `web/views/`. |

### Removed

- **`node-fetch`** — replaced by Node's global `fetch` (Node 18+). Removed in 2.0.0. Do not re-add.

## Dev dependencies

| Package | Major | Purpose |
|---------|-------|---------|
| `eslint` | 9 | Linting (flat config in `eslint.config.js`). |
| `@eslint/js` | 9 | ESLint recommended ruleset. |
| `globals` | 16 | Node + browser global sets for the flat config. |
| `prettier` | 3 | Formatting (`.prettierrc.json`). |
| `eslint-config-prettier` | 10 | Turns off ESLint rules that conflict with Prettier. |

### Test tooling (added 2.6.0)

Root `package.json`:

| Package | Major | Purpose |
|---------|-------|---------|
| `vitest` | 4 | Test runner for the Node-side suite (`tests/`, `vitest.config.js`, environment `node`). |
| `@vitest/coverage-v8` | 4 | V8 coverage for `*:coverage` scripts. |
| `@playwright/test` | 1 | E2E / visual-regression / a11y runner (`playwright.config.js`, `tests/e2e/`). Browser installed once with `npx playwright install chromium`. |
| `@axe-core/playwright` | 4 | axe accessibility scans inside the Playwright specs. |

`web-app/package.json` (the SPA's own jsdom suite, `web-app/vitest.config.js`):

| Package | Major | Purpose |
|---------|-------|---------|
| `vitest` + `@vitest/coverage-v8` | 4 | SPA test runner/coverage (environment `jsdom`). |
| `jsdom` | 29 | DOM for component tests. |
| `@testing-library/react` | 16 | Render/query React components. |
| `@testing-library/jest-dom` | 6 | DOM matchers (`toBeInTheDocument`, …). |
| `@testing-library/user-event` | 14 | User-interaction simulation. |

The SPA Vitest config reuses `vite.config.js`, so `import.meta.glob` (the browser loader's data bundle) and
the `lodash` alias resolve exactly as in the real build. **Landmine:** lodash captures `Math.random` at
import — `_.random/_.sample/_.shuffle` can't be RNG-stubbed (see `notes/plans/testing.md`).

### SPA editor — CodeMirror 6 (added 2.7.26)

The DPL boxes (prompt / negative / wrapper) are CodeMirror 6 editors (`gui/src/components/DplEditor.jsx`
over `gui/src/lib/dpl/dplLanguage.js`). `gui/package.json`:

| Package | Major | Purpose |
|---------|-------|---------|
| `@codemirror/state` · `@codemirror/view` | 6 | Editor core + the DOM view. |
| `@codemirror/language` | 6 | `StreamLanguage` (the DPL tokenizer) + `HighlightStyle` (tag → CSS class). |
| `@codemirror/autocomplete` | 6 | The brace-aware `{…}` / `{#…}` token-completion dropdown. |
| `@codemirror/commands` | 6 | Undo `history()` + the default/history keymaps. |
| `@codemirror/lang-javascript` | 6 | JS syntax highlighting for the Manage tab's JS-sidecar editor (`CodeEditor.jsx`); added 2.12.0. |
| `@lezer/highlight` | 1 | `Tag.define()` for the custom DPL highlight tags. |

Highlight **colors live in `styles.css`** (the `--dpl-*` variables, with a light-theme override), not in a JS
theme — so syntax coloring follows the app's light/dark theme. The tokenizer mirrors `src/core/dpl/dpl.js`
and only treats DPL structural keywords as keywords at the **start of a line**, so prose in the prompt box
isn't mis-highlighted. CodeMirror is framework-agnostic ESM and bundles cleanly under Vite/Rolldown (the
main chunk grew ~accordingly; the >500 kB chunk warning is pre-existing).

## Bumping deps

- Update `package.json`, run `npm install`, then **re-run the verification** in
  [`../plans/testing.md`](../plans/testing.md) (`node --check`, `npm run lint`, the import smoke test).
- For a dep with a breaking major, read its migration notes and grep for its usage first
  (`server.js`, `genImg.js`, `imageUpscaler.js`, `indexImages.js`, `common.js`, `makeApng.js` are the
  files that touch third-party APIs).
- Record the change here and in the changelog.
