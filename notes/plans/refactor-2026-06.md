# Codebase Refactor Plan (2026-06)

A phased, verification-gated refactor of `engine-v3/` to slim the build output, break up
the few genuinely oversized files, and modernize toward small, cohesive, easy-to-navigate
modules — **without** a big-bang rewrite. Every phase ships on its own `feature/*` branch and
must pass the full headless gate (`npm test`) before merge. The app stays green at every step.

Owner intent (2026-06-29): plan comprehensively first; **pragmatic** granularity (cohesive
modules, not dogmatic one-thing-per-file); run all phases this engagement, each committed on a
focused branch, stopping only for blockers.

## Guiding principles (the "pragmatic" bar)

- **Behavior-preserving.** This is a refactor, not a redesign. No feature changes, no UX
  changes, no prompt-output changes. Snapshot + unit + e2e/visual tests must stay green.
  Where a snapshot legitimately can't change, treat any diff as a regression to fix.
- **Cohesion over count.** Target: source files under ~300 lines, functions under ~100. But keep
  tightly-related small helpers together rather than exploding into 15-line files. A module is a
  *responsibility*, not a single function.
- **One default export = one concept.** React components: one component per file (sub-components
  that are only used by a parent and are trivial may stay co-located, but anything reused or
  >~40 lines gets its own file). Engine: group by pipeline stage (lex / parse / render / data).
- **Move, don't rewrite.** Prefer extracting existing code verbatim into new modules over
  re-authoring logic. Smaller diffs = safer review = fewer regressions.
- **Respect the existing conventions.** ESM with file extensions on every relative import;
  `src/chdir.js` stays imported first; `createRequire` plugin loading stays; keep JSDoc
  `@file`/`@module` headers; isomorphic engine (nodeLoader/browserLoader parity) preserved.
- **Verification floor every phase:** `npm run lint` + `npm run smoke` + `npm run test:unit` +
  `npm run test:web`, plus `npm run web:build` + `node scripts/check-bundle-size.mjs`, and for
  any UI-affecting phase, `npm run test:e2e`. Update visual baselines only on a deliberate,
  reviewed pixel change.

## Baseline (measured 2026-06-29, before any change)

- Production build: single `index-*.js` = **2,395 KB raw / 793 KB gzipped**; all other chunks
  ≤ ~2.6 KB. Total gzipped ≈ 810 KB against a **900 KB** budget (`check-bundle-size.mjs`).
- Vite 8 / Rolldown itself warns the chunk is > 500 KB and recommends code-splitting.
- Provider adapters already code-split (lazy `import()` → the small `generate-*`/`rewrite-*`/
  `upscale-*` chunks). The monolith is: react + react-dom, react-intl, **CodeMirror/@lezer**
  (used only by the Manage editor), lodash, the engine core, and **all prompt data eagerly
  globbed** by `src/core/browserLoader.js` (`import.meta.glob(..., { eager: true })`).
- Largest source files (lines): `Home.jsx` 1161, `SingleView.jsx` 870, `core/dpl/dpl.js` 824,
  `Manage.jsx` 695, `vite-plugin-api.js` 673, `ManageListEditor.jsx` 522, `dplLanguage.js` 501,
  `listManifest.js` 471, `WrapperFab.jsx` 428, `dplInserts.js` 408, `contentSafety.js` 397.
- Working tree effectively clean (the one "modified" snapshot is CRLF-only noise). `tmp/` holds
  136 untracked junk files (a stale `webapp-docs` copy) — not gitignored.

## Phases (ordered by leverage / risk)

### Phase 0 — Housekeeping (no logic) — branch `chore/refactor-prep`
- Remove/gitignore `engine-v3/tmp/` (stale `webapp-docs` duplicate polluting grep/lint).
- Confirm `scripts/list-cleanup/out/` stays ignored; sweep other obvious dead scratch files.
- No source behavior touched. Gate: lint + smoke + build.

### Phase 1 — Build code-splitting (highest leverage, lowest risk) — `feature/build-splitting`
Goal: turn the 2.4 MB monolith into focused, cacheable chunks; ship CodeMirror only when Manage
is opened. **No app logic changes.**
1. Lazy-load the heavy, conditionally-used views in `App.jsx` via `React.lazy` + `<Suspense>`:
   **Manage** (pulls all of CodeMirror), and **Gallery** + **SingleView** (local-only). Keep the
   "stay mounted to preserve state" behavior — lazy only defers the *first* mount, which already
   happens behind the online/`managerOk` gates. Manage is the big win (CodeMirror leaves the
   initial chunk entirely).
2. Configure deterministic vendor chunking. **Landmine:** Vite 8 uses **Rolldown**, so the option
   is `build.rolldownOptions.output.advancedChunks` (Rolldown), **not** Rollup's `manualChunks`.
   Verify the exact Rolldown chunking API against the installed version before writing it; fall
   back to `output.manualChunks` only if Rolldown still honors it. Split: `react`/`react-dom`,
   `react-intl`, `codemirror`+`@lezer`, `lodash`, and the engine/prompt-data into their own chunks.
3. Consider splitting the eagerly-globbed prompt data so SFW-only/online builds don't ship NSFW
   generators (investigate; only if it's clean and keeps nodeLoader/browserLoader parity —
   otherwise defer to a later phase rather than force it).
Gate: build + bundle-size (expect initial chunk to drop sharply; total gzipped ≈ same or lower),
full `npm test`, and `npm run test:e2e` (Manage/Gallery/Single still load behind Suspense).

### Phase 2 — `core/dpl/dpl.js` (824 → ~5 focused modules) — `feature/dpl-modular`
Cleanest decomposition in the codebase; it's a textbook compiler. Extract **verbatim**:
- `dpl/words.js` — the `INTENSITY_WORDS` + `FOCUS_WORDS` tables (~210 lines of pure data) and
  `intensityWord`/`focusWord`.
- `dpl/intensity.js` — `clampIntensity`/`clampFocus`/`scaleCount`/`applyIntensityMod`/`condPasses`
  + the intensity/focus constants and `RNG`/`weightedSampleN` (or a sibling `dpl/rng.js`).
- `dpl/parser.js` — `parseFrontMatter`, `lexLines`, `parseSections`, `buildTree`, `parseNode`,
  `parseBracketSpec`, `consumeBracket`.
- `dpl/renderer.js` — `renderNodes`, `renderNode`, `renderInlineBody`, `renderRef`, `joinPieces`,
  `weightOf`.
- `dpl/dpl.js` — keeps `compileDpl` (the public orchestrator) wiring the above together.
Gate: smoke (forces every dynamic prompt to compile) + unit + snapshot (prompt output identical) +
**both loaders** build (`npm run smoke` and `npm --prefix gui run build`, per the depth-sensitivity
rule). This phase is the strongest "no output change" candidate — snapshots are the guardrail.

### Phase 3 — `Home.jsx` (1161 → component + hooks + sub-views) — `feature/home-modular`
- `components/icons/` — extract the 6 inline SVGs (Share/Shuffle/Sparkle/Wand/Tag/Gear); reuse
  the same icon set in `Manage.jsx`/`SingleView.jsx` (dedupes inline SVGs across the app).
- `lib/home/snapshot.js` — `cleanSnapshot` + `SNAPSHOT_DROP`.
- `lib/home/categories.js` — `foldersOf`, `splitCats`, `MERGED_CATS`.
- `hooks/useGeneratedImages.js` — `removeImage`/`removeBatch`/`clearImages`/`clearAll` + the feed
  state they own.
- `hooks/usePromptBuilder.js` — `buildPrompts`/`insert`/`useSuggestion`/`copyPrompt`/`toggleShare`.
- Split the large JSX into `components/home/PromptComposer.jsx` + `components/home/ResultsFeed.jsx`;
  `Home.jsx` becomes the thin coordinator.
Gate: full `npm test` + `npm run test:e2e` (Home is the primary view; visual baseline matters).

### Phase 4 — `SingleView.jsx` (870) — `feature/single-modular`
Already internally well-seamed (TextRow, PromptCard, DetailRow/DetailTable, CopyButton,
LineageHead, DerivedStrips, KeywordsCard). Promote each presentational piece to its own file under
`components/single/`, plus `lib/single/markdown.js` (`toMarkdown`) and
`lib/single/json.js` (`syntaxHighlightJson`). `SingleView.jsx` keeps the top-level component.
Gate: full `npm test` + e2e/visual.

### Phase 5 — `Manage.jsx` (695) + Manage editor cluster — `feature/manage-modular`
- Reuse `components/icons/` (Caret/Gear/Edit/Refresh/Restore/Trash).
- `lib/manage/tree.js` — `defaultExpanded`, `rootTitle`, `badgeTitle`, `previewText`, `ROOTS`.
- `hooks/useManageTree.js` — the tree CRUD handlers (`loadTree`/`onRefresh`/`newFile`/`newFolder`/
  `moveEntryTo`/`deleteEntry`/`restoreGhost`/`handleChanged`).
- `components/manage/ManageDetail.jsx` — split out the detail pane.
- Confirm the CodeMirror editors (`DplEditor`/`CodeEditor`/`ManageBlockEditor`) sit fully behind the
  Phase-1 lazy boundary so none leak into the initial chunk.
Gate: full `npm test` + e2e (Manage behind the local-backend gate).

### Phase 6 — Remaining large modules (as time allows) — `feature/lib-modular`
`vite-plugin-api.js` (673; split by route/concern), `dplLanguage.js` (501) + `dplInserts.js` (408)
(highlight vs. completion vs. snippets), `listManifest.js` (471; resolve / group / manifest),
`contentSafety.js` (397), `WrapperFab.jsx` (428), `ManageListEditor.jsx` (522). Each only if it
yields a genuinely clearer structure; skip cosmetic-only splits.

## Sequencing & workflow

Phase order is fixed: **0 → 1 → 2 → 3 → 4 → 5 → 6**. Build-splitting first delivers the most
visible win at the least risk and is independent of the source decomposition. The engine (Phase 2)
is next because snapshots make it the safest behavioral guardrail. Components follow largest-first.

Per phase: branch off `dev` → extract in small commits (stage explicit paths, never `git add -A`)
→ run the full gate → write the changelog entry in the same commit + a session-log note →
`feature/*` merged back into `dev` with `--no-ff`. Version bump: **PATCH** per phase (internal
refactor, no user-facing change) bumping `VERSION` + both `package.json` files together; no MAJOR.
Release to `main` only on the owner's explicit go-ahead (refactors don't auto-release).

## Additional workstreams (added 2026-06-29, from owner requests)

### Workstream A — Seedable engine RNG (de-lodash randomness) — **separate, larger refactor**
The engine's random passes (emphasis, alternating, list `_.shuffle`/`_.sample`, keyword repeat,
random-editing, suggestion assembly, prompt-salt) call lodash `_.random`/`_.sample`/`_.shuffle`.
**lodash captures `Math.random` at import**, so the test seam `withSeed` (which swaps `Math.random`)
does NOT control them — only the DPL renderer (direct `Math.random`) is seedable today. Consequence:
any test of emphasis-affected output is a coin-flip, so exact-output tests must currently disable
emphasis (`keywordEmphasis:false`/`keywordAlternating:false`) instead of asserting real output.

The proper fix (its own phase/branch, **not** folded into the build/component refactor): add
`src/core/random.js` (or `src/helpers/random.js`) — tiny utilities matching the needed lodash
semantics (`random(lower,upper,floating)`, `sample`, `shuffle`, `chance`) but reading `Math.random`
**live** — and replace the engine's `_.random`/`_.sample`/`_.shuffle` call sites with them. Then
`withSeed` makes the entire engine reproducible, emphasis included, and the override unit tests can
drop the emphasis-off workaround and assert genuine seeded output. Touches ~10 files (active stages +
helpers only; the legacy `prompt-modules/` reference stays untouched). Verify with the seeded snapshot
suite before/after (single-entry-list snapshots must not move; multi-draw paths become deterministic).
Owner (2026-06-29): agreed this is a large, separate refactor — plan it, don't inline it.

### Workstream B — Performance profiling & optimization (build / runtime / browser)
Comprehensive, measured perf pass across all three surfaces:
- **Build:** track Vite/Rolldown build time; ensure the chunk graph stays clean; keep
  `check-bundle-size.mjs` as the gate and tighten `BUDGET_KB` as weight drops.
- **Runtime (engine):** profile the generate pipeline (DPL compile/render hot paths, list
  resolution, repeated catalog scans); memoize/cache where a pass re-derives the same data;
  avoid quadratic name resolution. Add a micro-benchmark harness so regressions are visible.
- **Browser (client):** the largest lever is the **454 KB-gzip `prompt-data` chunk** eagerly
  globbed for the Generate view — investigate deferring/splitting it (e.g. load NSFW generators
  and rarely-used categories on demand; load list bodies lazily, names eagerly) without breaking
  nodeLoader/browserLoader parity. Also: React render profiling (memoize heavy lists, virtualize
  the gallery/feed if needed), preconnect/preload hints, image `loading=lazy`/`decoding=async`,
  and confirm the lazy chunks prefetch sensibly.

### Workstream C — Web-vitals / SEO "page-rank" greenlight (Lighthouse)
Drive the existing `test:lhci` (Lighthouse CI) green across Performance / Accessibility / Best
Practices / **SEO**. Concretely: a descriptive `<title>` + meta description, canonical URL, Open
Graph/Twitter card tags, `lang` on `<html>`, `robots`/`sitemap` for the deployed site, favicon/PWA
manifest sanity, meaningful headings/landmarks (ties into the `@axe-core` e2e), and the Core Web
Vitals (LCP/CLS/INP) — which Phase 1 + Workstream B directly improve. Establish a Lighthouse
baseline first, then close the gaps and wire a target score into CI so the greenlight stays green.

## Risks & mitigations

- **Rolldown vs Rollup chunking API mismatch** (Vite 8) → verify the installed API before writing
  config; the build smoke-tests it immediately.
- **Generator import depth-sensitivity** → after any engine move, run `npm run smoke` (Node loader)
  **and** `npm --prefix gui run build` (browser glob) — a broken glob import only surfaces in the
  SPA build.
- **Lazy `<Suspense>` changing first-paint of a view** → covered by e2e/visual; provide a minimal
  fallback so there's no layout shift.
- **Snapshot drift in Phase 2** → any prompt-output diff is a real regression, not a baseline to
  bless; investigate before updating snapshots.
- **lodash RNG can't be stubbed** (captured at import) → keep using the seeded DPL renderer path
  the tests already rely on; don't introduce new `_.random`/`_.sample` in test-critical paths.
