# Testing

## The reality

There is **no automated test suite** today. This is the honest state, not a blueprint.

## How verification is done now

Until a suite exists, changes are verified with:

1. **`npm run lint`** — ESLint 9 flat config. 0 errors expected; the ~160 warnings are pre-existing
   unused-vars/style and are tracked, not blocking.
2. **`node --check <file>`** — syntax check on changed files. (The whole tree was checked during the
   2.0.0 migration: 152 files, 0 errors.)
3. **The import smoke test** — the most valuable check for module-wiring changes. A short script:

   ```js
   import common from "./common.js";
   import promptFiles from "./src/promptFilesAndSuggestions.js";
   import dynamicPrompt from "./prompt-modules/dynamic-prompt.js";
   const s = common.settings();
   promptFiles.init(common.settings);
   promptFiles.loadAll();                 // loads ALL ~113 dynamic prompts via require(ESM)
   promptFiles.promptSuggestion();        // exercises the cleanup module
   dynamicPrompt("#random", s.settings, s.imageSettings, s.upscaleSettings); // plugin .default()
   ```

   If this runs without throwing, the entire ES-module graph resolves, every dynamic prompt loads, and
   the default/named export contracts hold — without starting a server or touching the network.

   Run it with `node` from the repo root (write it to a scratch `.mjs`, run, delete — keep scratch files
   out of git and out of the lint path).

4. **Live run** (manual) — needs a Stable Diffusion WebUI with `--api`. See
   [`next-steps.md`](next-steps.md) item 1.

## Gaps / what a real suite should cover

- Promote the smoke test into a committed `npm test`.
- Unit-test the pure prompt stages: `prompt-modules/cleanup.js`, `list.js`, `prompt-salt.js`,
  `helpers/keywordRepeater.js`, `src/diffSettings.js`.
- Test settings merge (`loadSettings` + `applyArgs` + presets) without touching the network.
- The image index (`web/backend/indexImages.js`) against a small fixture `output/` folder.
- A mocked-`fetch` test of `genImg.js` / `imageUpscaler.js` so the WebUI contract is covered without a
  real WebUI.
