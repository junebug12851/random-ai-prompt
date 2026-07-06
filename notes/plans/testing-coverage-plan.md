# Comprehensive Test-Coverage Plan (2026-06-29)

A plan to take the existing suite from "every test type is represented" to "every
module is covered, thoroughly, with valid / invalid / edge inputs" — so upgrades
(deps, Node, providers, refactors) are safe.

**Status: APPROVED 2026-06-29; implementing on `feature/test-coverage`.** Owner decisions:
(1) **enforce coverage thresholds in CI** (engine src ~90%, lib ~85%); (2) **build all 5
phases, then one review** at the end (no per-phase pause); (3) **Chromium-first** — turn on
Firefox/WebKit/mobile in phase 5.

## Scope (confirmed with owner)

Build out the **core code layers** + **performance** + **cross-browser**. Skipping
production monitoring (Sentry/Datadog) by choice. Mapping the owner's 20-item list:

| Owner's layer | Where it lands here |
|---|---|
| 1 Static | already wired (`eslint`, `prettier`); add a check it actually gates |
| 2 Unit · 3 Component · 4 Interaction · 5 Integration · 6 Hooks | Vitest (Node + jsdom) — the bulk of new work |
| 7 API mocking | **add MSW** to the SPA suite; standardize loading/success/error/empty/slow/unauthorized |
| 8 E2E · 9 Visual · 10 Accessibility | Playwright — expand flows, add cross-browser |
| 11 Snapshot · 16 Regression · 17 Smoke | extend existing |
| 12 Storybook | **not adopted** (out of scope; component+interaction tests cover the "every state" need) |
| 13 Performance | **Lighthouse CI + bundle-size budget** (free, local + CI) |
| 14 Cross-browser | **Playwright Firefox + WebKit projects** (BrowserStack/Sauce are paid → skipped) |
| 15 Responsive/mobile | Playwright mobile viewport project (free, folds into cross-browser) |
| 18 Acceptance | expressed as the E2E user-flow specs |
| 20 Production monitoring | **not adopted** (owner's choice) |

## Current state (baseline, 2026-06-29)

Existing test files and their `describe/it` counts:

- **Node unit** (`tests/unit/`): cleanup 7, contentSafety 17, dpl 35, emphasis 10,
  gatedLists 9, keywordRepeater 8, listManifest 28, promptSalt 6, randomEmphasis.plain 4
- **Node integration** (`tests/integration/`): enginePipeline 21, manageFs 14
- **Node** regression 13, snapshot 5
- **E2E** (`tests/e2e/`): home 4, visual 4, accessibility 3
- **SPA** (`targets/web/tests/`): customStore 2, Field 8, gallery 11, promptEngine.integration 10,
  providers 11, settings 6, Settings 16, share 5, TokenPicker 4, validateDpl 12

Strong where it exists; the gaps below are whole modules with **zero** direct tests.

## Gap inventory (what's untested today)

### Engine (`src/`) — Node suite
- `helpers/randomEmphasis.js` — only the `Plain` branch is tested. **SD / NovelAI /
  Midjourney branches, `keywordEmphasis:false` no-op, de-emphasis roll, max-levels cap** untested.
- `helpers/randomEditing.js` — **untested** (edit-in / swap / edit-out; non-SD no-op; disabled no-op).
- `helpers/randomAlternating.js` — **untested** (alternation run, SD `[...]` wrap, MDJ no-op, NAI no brackets).
- `helpers/aliases.js` — trivial constants, fold into a tiny guard test.
- `core/listStore.js` — covered only indirectly. **Depletion, `listEntriesUsedOnce`,
  reload-on-empty, alias resolution (`keyword`/`artist`, `false` → random), artist & NSFW gating** untested directly.
- `core/stages/list.js` — covered only indirectly. **Emphasis path, NovelAI `()`→`{}` rewrite,
  artist detection, `{#name}` pass-through, nested token re-pull** untested directly.
- `core/stages/block.js` — covered only indirectly. **Dial arg parsing, `{#any}` family,
  implied + `.group` groups, dedup/stacking, auto-append fx/artists, NSFW gating, danbooru replacer,
  10-pass cap** untested directly.
- `core/engine.js` — `generate()` default-prompt fallback, `generateMany` count clamp (0/NaN/neg → 1),
  `promptModules` ordering + unknown-stage skip, `\r` stripping.
- `blockManifest.js` — **untested** (`isReservedAny`, `dynGroupDirs` v1 exclusion, `dynGroupMembers`).
- `promptFilesAndSuggestions.js` — **untested** (classification, `pickerListNames` adult on/off,
  `promptSuggestion` shapes, `gatePool`, `configure()`-not-called throw).
- `core/nodeLoader.js` — loader contract over a temp data dir (lists, groups, dpl, markers, meta).
- `settings.js` — a shape/type guard test (the master defaults the engine assumes).

### SPA (`targets/web/frontend/lib/`) — jsdom suite
- `keywords.js` — **untested** (`keywordKey` accents/Unicode, `cleanTag` lora/attention/weights/BREAK/AND/pipe,
  `parseKeywords` dedupe/maxLen/max/sort, `normalizeKeywordList`).
- `manageTree.js` — **untested** (`buildManageModel` categories/groups/NSFW-hide, `computeGhosts`,
  `injectGhosts`, `filterModel`).
- `rewrite.js` — **untested** (browser-direct path, proxy fallback, non-OK error).
- `output.js` — **untested** (`ingestImage` save/fallback, `isOutputFile`, `openImageInNewTab` data→blob,
  `fileAction` delete/reveal/open, `updateImageMeta`).
- `online.js` — **untested** (`ONLINE` flag, `lockedHint`, `openFullVersion`).
- `sessionKeys.js` — **untested** (`get/setSessionKey`, `effectiveKey` precedence).
- `providerMeta.js` — **untested** (`metaFor` known/unknown).
- `dpl/dplLanguage.js`, `dpl/dplInserts.js` — **untested** (CodeMirror language + insert-bar model).
- `magick.js`, `manageApi.js`, `runtimeLoader.js`, `wrapperStore.js`, `gallery.js`(partly), `providers/index.js` shim.
- Hooks: `useProvider.js`, `i18n/I18nProvider.jsx`, `settings.useSettings` (persist/load).

### SPA components — jsdom suite
Only Field, Settings, TokenPicker are covered. **Untested (~22):** App, ApiKeyField,
CodeEditor, DplEditor, DplInsertBar, DplStatus, Gallery, Home, InlineImageControls,
LivePreview, Manage, ManageBlockEditor, ManageFolderEditor, ManageListEditor, NsfwToggle,
PromptResult, ProviderBox, ProviderGear, ProviderPicker, ProvidersMenu, SettingsDrawer,
SingleView, WrapperFab.

### Providers (`targets/web/shared/`) — contract suite
Only `local-webui` + `midjourney` covered. **Untested adapters:** comfyui, openai, gemini,
grok, replicate, fal, bfl, ideogram, leonardo, stability `code/generate.js`; the rewrite
adapters (openai/gemini/grok `code/rewrite.js`); `_shared/transport/*` (hostedProxy,
localDirect, submitPoll); `_shared/dialects.js` (`engineModeFor`), `_shared/rewriteSystem.js`,
`_shared/fieldInfo.js`. (The former Netlify functions were removed; server-side dispatch now lives in `targets/web/backend/dispatch.js`.)

## Tooling changes

1. **MSW** (`msw`, dev dep in `targets/web/`). Add `targets/web/tests/msw/server.js` + handlers; wire
   `server.listen/resetHandlers/close` into `targets/web/tests/setup.js`. Migrate the ad-hoc
   `vi.stubGlobal("fetch", …)` provider tests onto it and add the standard network
   matrix (loading, 200, 4xx unauthorized, 5xx, empty body, slow/timeout).
2. **Playwright cross-browser** — add `firefox` and `webkit` projects + a `Mobile Chrome`
   (Pixel 7) viewport project to `playwright.config.js`. E2E + a11y run on all; **visual
   stays chromium-only** (pixel baselines are per-engine). One-time `npx playwright install
   firefox webkit`. CI matrix note added to `notes/reference/deployment.md`.
3. **Performance** — add `@lhci/cli`; `lighthouserc.json` with budgets (perf ≥ 0.9,
   a11y ≥ 0.95, no render-blocking regressions) run against `vite preview`. Add a
   **bundle-size budget** test (`tests/perf/bundleSize.test.js` or `size-limit`) asserting the
   built `dist/` main chunk gzip stays under an agreed ceiling. New scripts: `test:perf`,
   `test:lhci`.
4. **Coverage config fix** — root `vitest.config.js` `coverage.include` lists a non-existent
   `src/diffSettings.js`; replace with the real now-tested modules (`helpers/random*.js`,
   `blockManifest.js`, `promptFilesAndSuggestions.js`, `core/listStore.js`,
   `core/stages/*.js`). Add modest coverage **thresholds** so a future drop fails CI.
5. **Scripts** — extend root `package.json`: `test:e2e:all` (all browsers), `test:perf`;
   keep `test` (lint+smoke+unit+web) as the fast headless gate, `test:all` adds e2e+perf.
6. **CI** (`.github/workflows/ci.yml`) — add the SPA coverage run, the cross-browser e2e
   job (Linux), and a Lighthouse + bundle-budget job. Documented in `deployment.md`.

## Per-module case matrices (the thoroughness the owner asked for)

Each new test file drives the module across **valid, invalid, boundary, and adversarial**
inputs — not one value. Representative matrices for the highest-value modules:

**`helpers/randomEmphasis.js`** — for each mode (SD/NAI/MDJ/Plain): emphasis on/off,
de-emphasis roll forced both ways (stub `deEmphasisChance` 0 and 1), level cap honored
(`emphasisMaxLevels` 1 vs 3 with `emphasisLevelChance` 0/1), empty keyword, multi-word
keyword, `wasUsed` flag, custom `plainEmphasisWords` ladder + cap beyond ladder length.
(lodash-RNG landmine: assert structural invariants / bracket counts, not exact random picks.)

**`helpers/randomEditing.js`** — SD: each of edit-in `[k:n]` / swap `[k:k:n]` / edit-out
`[k::n]` shapes (force the `_.random(0,2)` branch via single-value min=max settings),
`n` within `[min,max]`; non-SD mode → no-op; `keywordEditing:false` → no-op; `wasUsed`.

**`helpers/randomAlternating.js`** — SD wraps run in `[a|a]`; NAI run without brackets;
MDJ → no-op (returns input, `wasUsed:true`); `keywordAlternating:false` no-op; level cap.

**`core/listStore.js`** — pull from single/multi-entry list; depletion empties then reloads;
`listEntriesUsedOnce:false` keeps entries; alias `keyword`→`keywordsFilename`,
`keywordsFilename:"false"`→random non-artist list; artist alias + `includeArtist:false`→"";
gated list + `includeAdult:false`→""; missing list→""; `reset()` clears state.

**`core/stages/block.js`** (over fakeLoader) — `{#name}` resolves; `{#a/b}` path;
`{#any}` picks one; implied group picks a member; `.group` file picks a member; dedup drops
2nd import; `stacking` exempt; `{#name i25% f80%}` dial parse (absent→50, 0→1, >100→100,
non-numeric ignored); auto-add fx/artists once (idempotent via imageSettings flags); NSFW
gating on/off; danbooru `, Person`→`{d/person}` only for `d/`/`danbooru` keyword file;
10-pass cap leaves no infinite loop; unknown `{#missing}`→"".

**`keywords.js`** — `keywordKey`: "Café"→"cafe", non-Latin unchanged, whitespace collapse;
`cleanTag` via `parseKeywords`: `<lora:x:0.8>` dropped, `(w:1.2)`/`((w))`/`[w]`/`{w}` keep inner,
`from:to:step` colons→space, `BREAK`/`AND` removed, `|` split, stray quotes; dedupe by key
("café"+"cafe"→1); `maxLen` drops run-ons; `max` caps count; `sort` alphabetizes by key;
empty/whitespace/null input → `[]`.

**`manageTree.js`** — `buildManageModel`: top-level = categories, force-prefix/group/NSFW
markers surface, NSFW entries hidden when `includeAdult:false` and shown when true, empty
folders kept, `.js` sidecar of same-name `.dpl` hidden; `compute​Ghosts` set-difference +
NSFW hide; `injectGhosts` creates missing folder nodes + recounts; `filterModel` keeps a
folder when name or descendant matches, returns null on no match.

**`listManifest.resolveListLines`** (extend) — already 28 tests; add the `{name}` vs
`{name-sfw}` vs `{name-nsfw}` × adult on/off truth table, group variant propagation, the
"stray `<base>` beside `<base>-nsfw` is ignored" safety rule, cycle guard at `MAX_GROUP_DEPTH`,
`keyword` wildcard excludes artist/danbooru + itself.

**`share.js`** (extend) — round-trip encode→decode; `keys` stripped; unicode/emoji survive
base64url; malformed hash→null; no hash→null; extra `&` params tolerated.

**`output.js`** — `ingestImage` returns served path on `{ok,path}`, falls back to `src` on
non-ok / network throw (MSW); `isOutputFile` true/false; `openImageInNewTab` data→blob path
(stub `URL.createObjectURL`/`window.open`), non-data direct open; `fileAction`/`updateImageMeta`
success + failure.

**Provider adapters** (per adapter, MSW-backed) — request shape (URL, method, headers incl.
auth, body fields) and response mapping to `{ images: [...] }`; error on non-OK with a
descriptive message; empty/missing-image response; default endpoint when URL unset. Rewrite
adapters: system prompt selection (fix vs keyword), `{ text }` extraction, error. Transport
`submitPoll`: submit→poll→complete, poll timeout, failure status.

**Components** (RTL + user-event) — each rendered in the `IntlProvider` wrapper:
render with default props, the key interaction (click/type/select/toggle), the disabled/locked
state (online build), and an empty/error state. E.g. `NsfwToggle` confirm-on-enable flow;
`ProviderPicker`/`ProviderBox` selection + BYOK key entry (session vs saved); `PromptResult`
copy/regenerate; `DplInsertBar` token insertion; `Gallery`/`SingleView` empty + populated;
`Home` type→generate→result wiring with the engine mocked.

## New files (inventory)

- Node unit: `tests/unit/{randomEmphasis,randomEditing,randomAlternating,aliases,listStore,
  listStage,blockStage,blockManifest,promptFilesAndSuggestions,engine,settings}.test.js`
- Node loader/integration: `tests/integration/{nodeLoader,enginePipeline.extended}.test.js`
- SPA lib: `targets/web/tests/lib/{keywords,manageTree,rewrite,output,online,sessionKeys,providerMeta,
  dplLanguage,dplInserts,wrapperStore,useProvider,manageApi}.test.js(x)`
- SPA components: `targets/web/tests/components/<Name>.test.jsx` (one per untested component)
- Providers: `targets/web/tests/providers/<id>.test.js` + `targets/web/tests/providers/{transport,rewrite,
  netlifyFunctions}.test.js`; `targets/web/tests/msw/{server,handlers}.js`
- Perf: `tests/perf/bundleSize.test.js`, `lighthouserc.json`
- E2E: extend `tests/e2e/` (manage flow, provider switch, share-link load, settings persist);
  add browser projects in `playwright.config.js`
- Regression/snapshot: add as gaps surface

## Phasing (so it lands reviewable, on `feature/test-coverage` off `dev`)

1. **Engine core** (highest upgrade-risk): random* helpers, listStore, the three stages,
   manifests, promptFilesAndSuggestions, engine, nodeLoader. + coverage-config fix.
2. **SPA lib + MSW**: keywords, manageTree, output, rewrite, online, sessionKeys, providerMeta,
   dpl language/inserts, hooks; stand up MSW and migrate provider tests onto it.
3. **Provider adapters + transport + netlify functions** (the upgrade-fragile network edges).
4. **Components**: the ~22 untested, RTL + user-event, valid/invalid/disabled/error states.
5. **Cross-browser + performance**: Playwright firefox/webkit/mobile projects; Lighthouse CI
   + bundle budget; CI wiring; refresh `notes/plans/testing.md` + `deployment.md`.

Each phase is its own commit(s) with `npm test` green; e2e/perf validated before the CI wiring
commit. Estimated **~250–350 new `it()` cases**. lodash-RNG landmine respected throughout
(invariants / single-entry lists / seeded DPL only).

## Verification

- After each module: `npm run lint` + `npm run test:unit` / `test:web` green.
- After each phase: full `npm test`; e2e/perf phases also `npm run test:e2e:all` + `test:perf`.
- Final: `npm run test:all` green on all browsers; coverage thresholds met; CI green on `dev`.
- A subagent review pass on the engine-core test phase (highest stakes) before merge.
