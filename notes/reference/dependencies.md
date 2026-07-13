# Dependencies

Current as of the 2.0.0 modernization (2026-06-18). Node **24 LTS**. Keep this in sync when you add,
remove, or bump a dependency.

## Runtime dependencies

The root package's runtime dependencies are now minimal — the engine has no framework deps, and the
classic CLI/server (and their deps) were removed. (The SPA's own runtime deps — React, react-intl,
CodeMirror, @fontsource — live in `targets/web/package.json` and are covered in the sections below.)

| Package | Major | Used by | Notes |
|---------|-------|---------|-------|
| `lodash` | 4 | the engine + data scripts | CJS default import (`import _ from "lodash"`). **Landmine:** it captures `Math.random` at import, so `_.random/_.sample/_.shuffle` can't be RNG-stubbed (see [`../plans/testing.md`](../plans/testing.md)). |
| `compromise` | 14 | the list-cleanup data scripts (`scripts/list-cleanup/*`) | NLP part-of-speech tokenization. Default import. |

### Removed

The pre-revival CLI + classic Express/Pug server were removed from the tree, and with them their
runtime dependencies:

- **`express`** / **`open`** / **`pug`** — the classic web server, browser-open, and Pug view engine.
- **`yargs`** — the classic CLI's argument parser.
- **`cli-progress`** — the CLI's terminal progress bars.
- **`crc`** — the APNG CRC helper.
- **`node-fetch`** — replaced by Node's global `fetch` (Node 18+). Removed in 2.0.0. Do not re-add.

## Desktop build (Tauri, added 2.43.0)

The pre-built desktop edition wraps the app in a [Tauri](https://tauri.app) shell. This adds a **Rust
toolchain** requirement — but only for building the desktop *installers*, never for running the app from
source or using the online edition. The shell bundles the platform's own `node` binary (the sidecar
runtime) and a production copy of the engine's runtime deps (`lodash` + `compromise`); it adds **no** new
JS runtime dependency to the app itself. See [`../systems/desktop.md`](../systems/desktop.md).

| Package | Where | Purpose |
|---------|-------|---------|
| `@tauri-apps/cli` | `gui` devDep (v2) | The `tauri` build/dev CLI (`npm run desktop:build`). |
| `tauri` | `targets/web/src-tauri` Cargo dep (v2) | The desktop shell runtime (native window + WebView). |
| `tauri-build` | `targets/web/src-tauri` Cargo build-dep (v2) | Tauri's build script. |
| `tauri-plugin-log` | `targets/web/src-tauri` Cargo dep (v2) | Debug logging in dev builds. |
| `tauri-plugin-updater` | `targets/web/src-tauri` Cargo dep (v2), **optional** | In-app desktop auto-updater. Behind the `updater` Cargo feature (OFF by default) — not compiled in a normal build. Activates when the owner adds the CI signing secret. See [`desktop-updater.md`](desktop-updater.md). |
| `tauri-plugin-dialog` | `targets/web/src-tauri` Cargo dep (v2), **optional** | Native confirm dialog for the auto-updater's "install now?" prompt. Same `updater` feature gate as above — not in the default build. |
| Rust (stable; MSVC on Windows) | build host / CI runners | Compiles the shell. Preinstalled on GitHub runners; via rustup locally. |

## Dev dependencies

| Package | Major | Purpose |
|---------|-------|---------|
| `eslint` | 9 | Linting (flat config in `eslint.config.js`). |
| `@eslint/js` | 9 | ESLint recommended ruleset. |
| `globals` | 16 | Node + browser global sets for the flat config. |
| `prettier` | 3 | Formatting (`.prettierrc.json`). |
| `eslint-config-prettier` | 10 | Turns off ESLint rules that conflict with Prettier. |
| `stylelint` | 17 | CSS linting (`stylelint.config.mjs`); run via `lint:css`, folded into `npm run lint`. Added 2.35.3. |
| `stylelint-config-standard` | 40 | Base CSS ruleset for stylelint (same family CodeFactor's CSS engine applies). Added 2.35.3. |

### Test tooling (added 2.6.0)

Root `package.json`:

| Package | Major | Purpose |
|---------|-------|---------|
| `vitest` | 4 | Test runner for the Node-side suite (`tests/`, `vitest.config.js`, environment `node`). |
| `@vitest/coverage-v8` | 4 | V8 coverage for `*:coverage` scripts. |
| `@playwright/test` | 1 | E2E / visual-regression / a11y runner (`playwright.config.js`, `tests/e2e/`). Browser installed once with `npx playwright install chromium`. |
| `@axe-core/playwright` | 4 | axe accessibility scans inside the Playwright specs. |

### Screenshot toolkit (added for `scripts/screenshots/`)

Root `package.json` dev deps used by the release-screenshot capture (`npm run screenshots`; published on
Pages by `.github/workflows/pages.yml`). It reuses the already-present `@playwright/test` to drive the
built SPA, plus:

| Package | Major | Purpose |
|---------|-------|---------|
| `gifenc` | 1 | Encode the GIF walkthroughs (CJS — import the default export; functions hang off it). Frames are diff-encoded against a shared palette so a full 1025×768 clip stays a few hundred KB. |
| `pngjs` | 7 | Decode Playwright PNG frames to RGBA for the GIF encoder, and synthesize gradient placeholder thumbnails for the seeded Gallery/Single screens. |

`targets/web/package.json` (the SPA's own jsdom suite, `targets/web/vitest.config.js`):

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

The DPL boxes (prompt / negative / wrapper) are CodeMirror 6 editors (`targets/web/frontend/components/DplEditor.jsx`
over `targets/web/frontend/lib/dpl/dplLanguage.js`). `targets/web/package.json`:

| Package | Major | Purpose |
|---------|-------|---------|
| `@codemirror/state` · `@codemirror/view` | 6 | Editor core + the DOM view. |
| `@codemirror/language` | 6 | `StreamLanguage` (the DPL tokenizer) + `HighlightStyle` (tag → CSS class). |
| `@codemirror/autocomplete` | 6 | The brace-aware `{…}` / `{#…}` token-completion dropdown. |
| `@codemirror/commands` | 6 | Undo `history()` + the default/history keymaps. |
| `@codemirror/lang-javascript` | 6 | JS syntax highlighting for the Manage tab's JS-sidecar editor (`CodeEditor.jsx`); added 2.12.0. |
| `@codemirror/lint` | 6 | Inline DPL error spots (underline + gutter + hover) fed by the shared `validateDpl` validator; also backs the editors' live ✓/✕ status icon. |
| `@lezer/highlight` | 1 | `Tag.define()` for the custom DPL highlight tags. |

Highlight **colors live in `styles.css`** (the `--dpl-*` variables, with a light-theme override), not in a JS
theme — so syntax coloring follows the app's light/dark theme. The tokenizer mirrors `engine/core/dpl/dpl.js`
and only treats DPL structural keywords as keywords at the **start of a line**, so prose in the prompt box
isn't mis-highlighted. CodeMirror is framework-agnostic ESM and bundles cleanly under Vite/Rolldown (the
main chunk grew ~accordingly; the >500 kB chunk warning is pre-existing).

### SPA internationalization — react-intl + FormatJS (added 2.15.0)

The SPA is internationalized with **react-intl**; the IDs/catalogs are produced by the **FormatJS**
tooling. All in `targets/web/package.json`:

| Package | Major | Purpose |
|---------|-------|---------|
| `react-intl` | 7 | The runtime i18n API: `IntlProvider`, `useIntl`, `defineMessages`, `FormattedMessage`, ICU formatting. |
| `babel-plugin-formatjs` | 10 | Build-time plugin (wired into `@vitejs/plugin-react`'s `babel.plugins`) that auto-fills each message's `id` from its `defaultMessage`+`description`, using the **same** `idInterpolationPattern` as the extractor so bundle IDs match the catalog IDs. |
| `@formatjs/cli` | 6 | The `formatjs extract`/`compile` CLI behind the `i18n:*` scripts. Extracts `src/i18n/messages/en.json`; compiles the `en-XA` **pseudo-locale** (requires `--ast`) to `src/i18n/compiled/`. |
| `eslint-plugin-formatjs` | 5 | The `enforce-default-message` rule, run by `npm run lint:i18n` via the focused, gui-scoped `targets/web/eslint.config.js`. |
| `eslint` | 9 | Needed locally in `targets/web/` to run `lint:i18n` (the repo-root ESLint config ignores `targets/web/**`). |

The i18n module lives at `targets/web/frontend/i18n/` (`config.js`, `loadMessages.js`, `I18nProvider.jsx`, `index.js`).
`loadMessages.js` bundles the compiled catalogs with `import.meta.glob` (same mechanism as the engine's
browser data loader). The source locale `en` needs no catalog — react-intl renders from the inline
`defaultMessage` kept in the bundle (`babel-plugin-formatjs` `removeDefaultMessage: false`). Regenerate
catalogs with `npm run i18n` after touching messages.

### SPA fonts — self-hosted via @fontsource (added 2.30.1)

The SPA's fonts are **self-hosted** (no Google Fonts request — removes the IP-to-Google transfer). In
`targets/web/package.json` as devDependencies, used only as the **source** of the `.woff2` files:

| Package | Purpose |
|---------|---------|
| `@fontsource/maven-pro` | Source of the body-font `.woff2` (weights 400/500/600/700, latin). |
| `@fontsource/space-grotesk` | Source of the display-font `.woff2` (weights 500/600/700, latin). |

The actual files shipped are the seven `targets/web/public/fonts/*-latin-<wt>-normal.woff2` (committed static
assets) declared via `@font-face` in `targets/web/public/fonts/fonts.css`, which both `index.html` and the
static `public/legal/*.html` pages load. The packages aren't imported at build or runtime — to refresh
fonts, `npm i` then re-copy `node_modules/@fontsource/<f>/files/<f>-latin-<wt>-normal.woff2` into
`public/fonts/`.

## Bumping deps

- Update `package.json`, run `npm install`, then **re-run the verification** in
  [`../plans/testing.md`](../plans/testing.md) (`node --check`, `npm run lint`, the import smoke test).
- For a dep with a breaking major, read its migration notes and grep for its usage first. The code that
  touches third-party APIs is the provider adapters (`targets/shared/**`) and the SPA libs; the engine
  itself only uses `lodash`.
- Record the change here and in the changelog.
