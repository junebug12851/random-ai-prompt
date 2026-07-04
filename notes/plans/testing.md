# Testing

## 2026-07-04 — large-scale performance suite (`tests/perf/`)

A dedicated Playwright suite guards the **officially supported maximum simultaneous load** (100k-image
gallery + 1000 prompts / ~10k images + a 100k-line Manage file, all at once). It runs against the **real
release server** (`gui/server/serve.js`) via `playwright.perf.config.js` — so the Manage file-read and
`fs.watch` hot-reload paths are exercised for real; the 100k gallery feed + image bytes are route-mocked
in-spec. Serial (`workers: 1`) so scenarios don't skew each other's timing; Chromium launched with
`--enable-precise-memory-info` for the heap-ceiling checks.

- **Specs:** `gallery.perf` (100k images, bounded DOM + smooth scroll), `generate.perf` (1000 prompts
  roll out + smooth scroll + fast Single↔Generate switch), `manage.perf` (100k-line list: windowed rows,
  responsive 100k-entry filter, entry↔raw switch), `hotreload.perf` (add/modify a 100k-line file on disk
  → no freeze, auto-refresh), and `tabs.perf` (the combined max load: all three loaded, tab switching +
  **round-trip scroll quality** + heap ceiling).
- **Robust, not flaky (by design):** the primary assertions are structural — rendered DOM-node counts
  (the virtualization proof) and a JS-heap ceiling — plus generous response/frame budgets
  (`tests/perf/helpers.js#BUDGETS`) set to flag pathology (an un-virtualized surface janks + blows the
  heap by orders of magnitude), not micro-noise. Fixtures/helpers in `tests/perf/fixtures.js` +
  `helpers.js`; on-disk fixtures are `perf-harness-*` (git-ignored, removed on teardown). Supporting unit
  tests: `gui/tests/lib/windowRange`, `gui/tests/providers/sharedSettings`, and extended
  `useImageBatches` (instant placeholders + concurrency cap).
- **Run it:** `npm run test:perf:scenarios` (in `test:all` and the `perf-scenarios` CI job). Profiler:
  `npm run profile` (`scripts/profile-scenarios.mjs`) → DevTools traces + `Performance` metrics + frame
  stats in `perf-profile/` (git-ignored). Note: the older `npm run test:perf` is the separate
  bundle-size budget — unrelated.

## 2026-06-29 — comprehensive coverage expansion

A full pass took the suite from "every test type represented" to "every module covered,
thoroughly, with valid/invalid/edge inputs" (plan: `notes/plans/testing-coverage-plan.md`).
**419 headless tests** now pass (Node 226 + SPA 193, up from ~138 + ~60).

- **Engine (Node):** direct unit tests for the `random*` helpers, the loader-injected stages
  (`listStore`/`list`/`dynamicPrompt`), `dynPromptManifest`, `promptFilesAndSuggestions`,
  `engine` edges, `settings`/`aliases` guards, extra `listManifest` cases, and a real-data
  `nodeLoader` integration test.
- **SPA (jsdom):** `gui/tests/lib/**` (keywords, manageTree, output, rewrite, online,
  sessionKeys, providerMeta, wrapperStore, dplInserts, dialects, useProvider),
  `gui/tests/providers/**` (transport, server/rewrite adapters, browser generate wrappers,
  dispatch + Netlify handlers), `gui/tests/components/**` (NsfwToggle, PromptResult, DplStatus,
  DplInsertBar, ProviderPicker, ApiKeyField). Network is mocked with **MSW**
  (`gui/tests/msw/`, wired into `tests/setup.js`, `onUnhandledRequest: "bypass"`).
- **Coverage gates (CI-enforced):** root `vitest.config.js` thresholds — statements 88 /
  branches 76 / functions 88 / lines 90 (engine ~93% lines); `gui/vitest.config.js` —
  modest global floor + a `src/lib/**` floor (lines/statements 65, functions 60, branches 50).
  CI now runs `test:coverage` (Node) and `test:coverage` (SPA) so the gates actually fire.
  `browserLoader.js`, `dpl/dplLanguage.js`, and `providers/index.js` are excluded (covered via
  the browser/e2e path or not meaningfully unit-coverable).
- **Performance:** `npm run test:perf` builds the SPA and runs `scripts/check-bundle-size.mjs`
  (gzipped-JS budget, currently 763 KB vs a 900 KB budget); `npm run test:lhci` runs Lighthouse
  CI (`lighthouserc.json`, informational in CI — the bundle budget is the hard gate).
- **Cross-browser:** `npm run test:e2e:all` (sets `PLAYWRIGHT_ALL_BROWSERS`) runs the e2e +
  a11y specs on Chromium + Firefox + WebKit + a Pixel-7 mobile viewport; visual-regression
  stays Chromium-only. One-time: `npx playwright install firefox webkit`.
- **New CI jobs:** `cross-browser` (FF/WebKit/mobile, visual skipped) and `perf` (bundle budget
  hard gate + Lighthouse informational), alongside the existing check/gui/e2e jobs.

## The reality (as of 2026-06-22)

The project now has a **full automated test suite** built on **Vitest** (Node + jsdom)
and **Playwright** (browser). It covers the active engine and the SPA across every
standard test type. The pre-revival CLI + classic server were **removed** from the tree, so they're out
of scope; the two live pipeline stages they once shared (`cleanup.js`, `prompt-salt.js`) now live in
`src/core/stages/` and are tested with the rest of the engine.

## Layout

```
tests/                         # Node-side suite (Vitest, environment: node)
  helpers/                     # seededRandom.js (mulberry32 + withSeed), fakeLoader.js
  unit/                        # pure-module unit tests
  integration/                 # engine pipeline over a fake loader
  contract/                    # (provider/API contracts live in gui — see below)
  snapshot/                    # seeded, reproducible output snapshots
  regression/                  # bug-regression guards (one per fixed defect)
  e2e/                         # Playwright specs: home.spec, visual.spec, accessibility.spec
                               #   + visual.spec.js-snapshots/ (committed visual baselines)
vitest.config.js               # root (node) config
playwright.config.js           # builds the SPA + serves dist via `vite preview`

gui/
  tests/                       # SPA suite (Vitest, environment: jsdom)
    *.test.js                  # unit (share, settings, customStore) + contract (providers)
    *.test.jsx                 # component/UI (Field, TokenPicker) via Testing Library
    promptEngine.integration.test.js  # real browser engine over the bundled data
    setup.js                   # jest-dom matchers + localStorage reset + RTL cleanup
  vitest.config.js             # jsdom config (reuses vite.config: react plugin, lodash alias)
```

## Test types covered

| Type | Where | Notes |
|------|-------|-------|
| **Unit** | `tests/unit/**`, `gui/tests/*.test.js` | contentSafety, diffSettings, keywordRepeater, gatedLists, listManifest, DPL compiler, cleanup, prompt-salt; SPA share/settings/customStore |
| **Component / UI** | `gui/tests/*.test.jsx` | Field controls, TokenPicker — React Testing Library + jsdom |
| **Integration** | `tests/integration/**`, `gui/tests/promptEngine.integration.test.js` | full stage pipeline via a fake loader (Node) and via the real bundled-data browser loader (SPA) |
| **E2E** | `tests/e2e/home.spec.js` | Playwright drives the built SPA: type → generate → results; block search |
| **Visual regression** | `tests/e2e/visual.spec.js` | `toHaveScreenshot` of stable chrome (topbar, sidebar, full page with the random suggestion masked) |
| **Accessibility** | `tests/e2e/accessibility.spec.js` | `@axe-core/playwright`, WCAG 2 A/AA, fails on serious/critical (color-contrast excluded — tracked) |
| **Snapshot** | `tests/snapshot/**` | seeded (Math.random) DPL + pipeline output |
| **Contract / API** | `gui/tests/providers.test.js` | SD WebUI `txt2img` request/response contract, `fetch` mocked |
| **Smoke** | `scripts/smoke-test.mjs` (`npm run smoke`) | the original import-graph smoke, still the fast gate |
| **Bug regression** | `tests/regression/bugRegressions.test.js` | one guard per fixed defect / documented landmine |

## Running

```
npm test            # lint + smoke + Node unit/integration/snapshot/regression + SPA suite
npm run test:unit   # Node-side Vitest only
npm run test:web    # SPA Vitest only (jsdom)
npm run test:e2e    # Playwright E2E + visual + a11y (builds the SPA, serves dist)
npm run test:all    # everything, including E2E
npm run test:coverage / test:web:coverage   # with coverage
npm run test:e2e:update                      # refresh committed visual baselines
```

`npm run test:e2e` needs the Playwright browser once: `npx playwright install chromium`. The config sets
`channel: "chromium"` so the full chromium build is used (no separate `chromium-headless-shell` download).

**Windows runtime prerequisite:** Chrome-for-Testing needs the **Microsoft Visual C++ Redistributable**.
Without it, the browser fails to launch with `spawn UNKNOWN` → "side-by-side configuration is incorrect".
On this machine the bundled Chrome-for-Testing build hit the SxS error even with the VC++ runtime present,
so the config uses **`channel: "chrome"`** (the system-installed Google Chrome, version-matched to the
Chromium Playwright targets). CI can drop that `channel` to use the bundled browser. The Vitest suites
(`npm test`) have no browser dependency. First `test:e2e` run writes the visual baselines under
`tests/e2e/visual.spec.js-snapshots/` (committed).

## Gotchas baked into the suite

- **lodash captures `Math.random` at import**, so `_.random` / `_.sample` / `_.shuffle`
  cannot be stubbed by overriding `Math.random`. Tests that touch lodash randomness assert
  **invariants** (token counts, value shape) or use **single-entry lists**; only the DPL
  renderer (its own `Math.random`-based RNG) is made deterministic with `withSeed`.
- The SPA Vitest config reuses `vite.config.js` so `import.meta.glob` (the browser loader's
  data bundle) and the `lodash` alias resolve exactly as in the real build.
- Visual baselines are committed under `tests/e2e/visual.spec.js-snapshots/`; regenerate them on a
  deliberate UI change with `npm run test:e2e:update`.

## Adding a bug-regression test

When you fix a bug, add an `it("regression: …")` to
`tests/regression/bugRegressions.test.js` that fails on the old behaviour and passes on the
fix, with a one-line note on the original symptom. That permanently locks the fix.
