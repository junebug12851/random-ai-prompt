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
3. **Add an automated test/smoke harness.** Promote the manual import smoke test into a committed script
   (e.g. `npm test` running a Node script that loads the graph, loads all dynamic prompts, and asserts
   a few prompt expansions). Optionally a couple of unit tests for `cleanup`/`list`/`prompt-salt`.
   See [`testing.md`](testing.md).
4. **README refresh.** The root `README.md` predates 2.0.0; update the run instructions to the `npm`
   scripts and note the Node 24 requirement.
5. **Optional: modernize `web/frontend/`.** Convert the browser scripts to modules/bundling and tighten
   their lint. Out of scope for the Node migration; do only if desired.
6. **Optional: consider in-process generation** instead of the server-spawns-CLI design (see
   [`future.md`](future.md)).
7. **Review the 6 `no-useless-assignment` spots.** ESLint 10 promoted this rule into `recommended`; it
   flags benign init-then-overwrite patterns in `src/server.js` (×3), `src/web/backend/indexImages.js`
   (×2), and `src/web/frontend/single.js` (×1). Currently demoted to `warn` in `eslint.config.js`.
   Either tidy the dead stores or leave as-is (changing them is behavior-neutral here, but low value).
