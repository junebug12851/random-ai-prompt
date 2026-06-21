# Next Steps

Ordered, roughly by priority. Update as items are done or added.

0. **Web SPA bundle size.** The phase-3 engine port bundles the list/expansion text and all 113
   dynamic prompts eagerly (~712 KB gzipped). Trim it: serve the larger list files (`danbooru`, `d-*`)
   from `public/` via runtime fetch instead of inlining, switch dynamic-prompt imports to a lazy glob,
   and/or use `lodash-es` for tree-shaking. Not blocking, but worth doing before launch.

1. **Live end-to-end verification with a Stable Diffusion WebUI.** Start a WebUI with `--api`, then
   exercise: CLI generate (`npm start`), the web UI (`npm run server`) feed/search/settings, and one
   each of variation, reroll, upscale, and animation. This is the one thing the modernization could not
   verify (no WebUI was running). Confirms the `node-fetch`→`fetch` migration and Express 5 routes in
   practice.
2. **Review the `no-dupe-else-if` warnings.** Several `dynamic-prompts/*` files (e.g.
   `portrait-princess.js`, `portrait.js`, `v1/person.js`, `v1/castle.js`, `v1/princess-simple.js`,
   `futuristic.js`, `beach.js`) have duplicate `else if` conditions — likely latent bugs in the prompt
   generators. Decide the intended condition per case (this *will* change generated prompts), or
   confirm they're harmless. Don't bulk-edit.
3. **Grow the test harness into real assertions.** The import **smoke test now exists** (committed as
   `scripts/smoke-test.mjs`, run by `npm run smoke` / `npm test`, and in CI) — it loads the full module
   graph, forces every dynamic prompt through `require(ESM)`, and expands a prompt. Next: add actual
   **unit tests** (e.g. for `cleanup` / `list` / `prompt-salt`) and a small browser-engine assertion for
   the SPA's `core/` path. See [`testing.md`](testing.md).
4. **README refresh.** The root `README.md` predates 2.0.0; update the run instructions to the `npm`
   scripts, note the Node 24 requirement, and mention the `web-app/` SPA and the `npm run docs` doc-site.
5. **Finish the SPA UI rework, then re-enable the Generate + Settings tabs.** The React + Vite `web-app/`
   exists and only the **Build** tab is currently shown while the UI is reworked. Complete that rework
   and unhide the other tabs. (The older `web/frontend/` jQuery client modernization is now largely
   superseded by this SPA — do it only if the classic server is kept long-term.) The 2026-06-19
   home-screen refinement removed several working features (image generation, chaos, presets, the
   Settings button/drawer, the mode badge) to be brought back — tracked in
   [`removed-pending-readd.md`](removed-pending-readd.md). The owner wants presets re-added as a richer
   thing (full settings + auto-generation), not the old apply/save dropdown.
6. **Optional: consider in-process generation** instead of the server-spawns-CLI design (see
   [`future.md`](future.md)).
7. **DPL (Dynamic Prompt Language) — the active next build.** Design done — a Markdown-shaped,
   non-programmer-first language for authoring generators, with a two-way JS bridge for the logic-heavy ~10%
   (the `entity` family, the keyword-pile / suggestion / danbooru builtins). Full proposal + requirements
   coverage in [`../reference/dpl-design.md`](../reference/dpl-design.md); mockup analysis in
   [`../reference/dpl-language.md`](../reference/dpl-language.md). **DPL is built first because it's wired into
   the v3 engine** (item 8). Prototype a parser/compiler that turns `.dpl` → the weighted-layer render → the
   existing generator contract, with `.js`/`.dpl` loaders coexisting for incremental migration. Most mechanics
   are settled (weights `[n]` auto-from-1000, local recursive sort, `go to`/`go back`, `one of`/`N of`,
   repetition modes); remaining: indentation strictness, exact `ctx` bridge surface, file layout.

7a. **DPL build status (in progress).** Engine (`src/core/dpl/dpl.js`) + 25 tests done; entire v2 catalog
   converted to `data/dynamic-prompts/v3/` (`.dpl` + JS sidecars); node + browser loaders + the
   dynamic-prompt stage + the classifier now load v3 as the **default** catalog, with v1/v2 frozen and
   addressed by `{#v1/…}` / `{#v2/…}` path prefixes (no `-v1`/`-v2` suffix). smoke + web build + an
   end-to-end engine check (`scripts/dpl-engine-check.mjs`) all green. **Remaining:** Phase 4 UI (DPL prompt
   box + open/close wrapper-preset boxes); optional `.dpl` checks in `npm test`; the v3 weighted-layer
   *render* (local weight sort) is implemented in the DPL engine but the broader engine still appends
   auto-fx/artists — revisit per the v3 "no auto fx/artists" intent.

8. **v3 — the weighted-layer prompt engine.** Direction in [`v3-layers.md`](v3-layers.md): ordering-by-weight
   over a layer tree (file/section/line are layers; the prompt box is the root); weights are **local** (sort
   within container, recursive depth-first render, auto from 1000); retire the "full prompt" concept so the
   engine — not each block — supplies start/end framing (delivery UX still open, likely presets). DPL (item 7)
   is its authoring language and comes first. No de-duplication (non-goal).

9. **Review the 6 `no-useless-assignment` spots.** ESLint 10 promoted this rule into `recommended`; it
   flags benign init-then-overwrite patterns in `src/server.js` (×3), `src/web/backend/indexImages.js`
   (×2), and `src/web/frontend/single.js` (×1). Currently demoted to `warn` in `eslint.config.js`.
   Either tidy the dead stores or leave as-is (changing them is behavior-neutral here, but low value).
