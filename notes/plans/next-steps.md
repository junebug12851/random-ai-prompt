# Next Steps

Ordered, roughly by priority. Update as items are done or added.

0000. **⚠️ The engine costs ~23–30 ms/prompt on the CI emulator vs 0.18 ms/prompt in Node — a ~150× gap.**
   Measured on device (2.60.0): 1000 prompts = engine 23–31 s, render 272 ms. The render is fine; on a
   phone the **engine is the whole cost**.

   **What has been ruled out** (`scripts/profile-engine.mjs`, run with the *same* loader the phone uses):

   | N | Node + metroLoader | per prompt |
   |---|---|---|
   | 20 | 4.5 ms | 0.227 ms |
   | 200 | 38.7 ms | 0.193 ms |
   | 1000 | 178.8 ms | **0.179 ms** |

   Flat and linear — there is **no hidden quadratic** and no pathological algorithm. So the gap is the
   *runtime*: Hermes (no JIT) executing on an emulated CPU on a shared runner. That is a plausible 150×,
   though at the high end of plausible.

   **What would settle it** (do this before optimising anything):
   1. Run the suite against a **real handset** (`npm run test:mobile:device` with `DETOX_ADB_NAME` set).
      *Blocked today:* the owner's phone has Developer Options carrier-locked, so no adb — needs a
      different device, or an emulator on a machine with native virtualization.
   2. If a real device is still slow, profile the DPL path under Hermes. Suspects, in order: regex-heavy
      stages, and per-prompt allocation (Hermes' GC is far less forgiving than V8's).
   3. Any fix lands in the engine, so every target gets it.

   No promise is broken — the app produces all 1000 and the list stays smooth — but a user rolling 1000
   prompts on a phone waits ~25 s for the engine, and that is worth knowing rather than assuming.

000. ~~**🔴 SECURITY — CodeQL's alerts on the local backend (1 critical, several high).**~~ **FIXED
   (2.60.1).** The critical command-injection, the prototype pollution, the world-writable temp cache
   and the check-then-use races are all closed — see the changelog. Remaining, and worth a look:
   medium `js/file-access-to-http` ×2 in `targets/cli/src/lib/` (a file path reaching an HTTP request —
   review whether the CLI should be reading arbitrary local files into a provider call at all).


0. **De-duplication campaign — push shared behavior down, keep targets thin.** See
   [`de-duplication.md`](de-duplication.md). Phases A/B (one provider registry for all three runtimes +
   an injectable transport + provider metadata on the manifests) are **done** (2.52.0–2.53.0). **Next: C** —
   mobile swaps its 892-line `imageProviders.js` for the shared registry (blocked on making mobile's
   provider-settings sheet load its schema **async**, like the web's gear). Then D (engine-domain logic
   still hand-ported in mobile: `dplInserts`/`listOps`/`blockCatalog`/rewrite systems) and E (retire
   the drift checks the duplication made necessary).
00. **Old `/generate` carry-over — Sweep 1 (prune).** Full disposition of every legacy prompt-page control
   in [`generate-page-triage.md`](generate-page-triage.md). Sweep 1 = drop the DPL-replaced randomization
   knobs (chaos, keyword counts, auto-fx/artists, anime words), all animation settings, and the salt
   settings — **in the new SPA/core engine only** (the classic `generate.pug` is frozen, being deleted).
   Then Sweep 2 ports the keepers (`promptCount`, keyword/artist list selectors, F paths) into the SPA UI.
   Sweeps 3–4 (park per-image actions for the image editor; provider abstraction + emphasis rework) are
   later.

0. **Web SPA bundle size.** The phase-3 engine port bundles the list/expansion text and all 113
   blocks eagerly (~712 KB gzipped). Trim it: serve the larger list files (`danbooru`, `d-*`)
   from `public/` via runtime fetch instead of inlining, switch block imports to a lazy glob,
   and/or use `lodash-es` for tree-shaking. Not blocking, but worth doing before launch.

1. **Live end-to-end verification with a Stable Diffusion WebUI.** Start a WebUI with `--api`, then
   exercise: CLI generate (`npm start`), the web UI (`npm run server`) feed/search/settings, and one
   each of variation, reroll, upscale, and animation. This is the one thing the modernization could not
   verify (no WebUI was running). Confirms the `node-fetch`→`fetch` migration and Express 5 routes in
   practice.
2. **Review the `no-dupe-else-if` warnings.** Several `blocks/*` files (e.g.
   `portrait-princess.js`, `portrait.js`, `v1/person.js`, `v1/castle.js`, `v1/princess-simple.js`,
   `futuristic.js`, `beach.js`) have duplicate `else if` conditions — likely latent bugs in the prompt
   generators. Decide the intended condition per case (this *will* change generated prompts), or
   confirm they're harmless. Don't bulk-edit.
3. **Grow the test harness into real assertions.** The import **smoke test now exists** (committed as
   `scripts/smoke-test.mjs`, run by `npm run smoke` / `npm test`, and in CI) — it loads the full module
   graph, forces every block through `require(ESM)`, and expands a prompt. Next: add actual
   **unit tests** (e.g. for `cleanup` / `list` / `prompt-salt`) and a small browser-engine assertion for
   the SPA's `core/` path. See [`testing.md`](testing.md).
4. **README refresh.** The root `README.md` predates 2.0.0; update the run instructions to the `npm`
   scripts, note the Node 24 requirement, and mention the `targets/web/` SPA and the `npm run docs` doc-site.
5. **Finish the SPA UI rework, then re-enable the Generate + Settings tabs.** The React + Vite `targets/web/`
   exists and only the **Build** tab is currently shown while the UI is reworked. Complete that rework
   and unhide the other tabs. (The older `web/frontend/` jQuery client modernization is now largely
   superseded by this SPA — do it only if the classic server is kept long-term.) The 2026-06-19
   home-screen refinement removed several working features (image generation, presets, the
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

7a. **DPL build status.** Engine (`engine/core/dpl/dpl.js`) + 25 tests; entire v2 catalog converted to
   `engine/data/blocks/v3/` (`.dpl` + JS sidecars); node + browser loaders + the block stage +
   the classifier load v3 as the **default** catalog, v1/v2 frozen and addressed by `{#v1/…}` / `{#v2/…}`
   path prefixes (no suffix). The SPA has the **wrapper** UI (bottom-right button → preset list → Manage
   modal with two Start/End boxes; frames generation) and v3-default building blocks. smoke + web build
   (597 modules) + `scripts/dpl-engine-check.mjs` all green. **Remaining/optional:** wire `.dpl`/engine
   checks into `npm test`; the broader engine still auto-appends fx/artists — revisit per the v3
   "no auto fx/artists" intent; persist wrapper presets across the share-link if desired; image-gen etc.
   (the older removed features in `removed-pending-readd.md`).

8. **v3 — the weighted-layer prompt engine.** Direction in [`v3-layers.md`](v3-layers.md): ordering-by-weight
   over a layer tree (file/section/line are layers; the prompt box is the root); weights are **local** (sort
   within container, recursive depth-first render, auto from 1000); retire the "full prompt" concept so the
   engine — not each block — supplies start/end framing (delivery UX still open, likely presets). DPL (item 7)
   is its authoring language and comes first. No de-duplication (non-goal).

9. ~~**Review the 6 `no-useless-assignment` spots.**~~ **Resolved** — all six were in the pre-revival
   classic files (`src/server.js`, `src/web/backend/indexImages.js`, `src/web/frontend/single.js`),
   which were removed from the tree along with the rest of that system.

10. **Responsive / adaptive UI — mobile + tablet.** Full blueprint in [`responsive.md`](responsive.md):
    a fluid `clamp()` foundation + container queries, adopting the empty `layout` cascade layer, with a
    few deliberate tablet/phone layout modes (top bar → single top overflow menu, sidebar → drawer,
    two-pane views → stacked). **No feature removed at any width** — features relocate. CSS-first to keep
    the online prerender/hydrate SSR-safe. Phase 1 (fluid token foundation) landed on
    `feature/responsive-foundation`; Phases 2–6 queued.
