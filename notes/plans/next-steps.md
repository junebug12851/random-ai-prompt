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
7. **DPL (Dynamic Prompt Language).** Design done — a Markdown-shaped, non-programmer-first language for
   authoring `{#name}` generators, with a JavaScript escape hatch for the logic-heavy ~10% (the `entity`
   family, the keyword-pile / suggestion / danbooru builtins). Full proposal + requirements coverage in
   [`../reference/dpl-design.md`](../reference/dpl-design.md); mockup analysis in
   [`../reference/dpl-language.md`](../reference/dpl-language.md). Next: settle the open questions (indentation
   rule, `+name(args)` scope, file layout) and prototype a parser that compiles `.dpl` → the existing
   generator contract, with the `.js`/`.dpl` loaders coexisting for incremental migration.

8. **v3 — the weighted-layer prompt engine.** Direction captured (exploratory) in
   [`v3-layers.md`](v3-layers.md): replace ordering-by-position with ordering-by-weight over a layer tree
   (file/section/line are layers; the prompt box is the root), retire the "full prompt" concept and have the
   engine supply start/end blocks (likely via presets). DPL is its authoring language. Several mechanics still
   open (weight scope, sort key, start/end UX). Shapes the DPL build (item 7) — settle these before coding.

9. **Review the 6 `no-useless-assignment` spots.** ESLint 10 promoted this rule into `recommended`; it
   flags benign init-then-overwrite patterns in `src/server.js` (×3), `src/web/backend/indexImages.js`
   (×2), and `src/web/frontend/single.js` (×1). Currently demoted to `warn` in `eslint.config.js`.
   Either tidy the dead stores or leave as-is (changing them is behavior-neutral here, but low value).
