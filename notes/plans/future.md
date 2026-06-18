# Future / Longer-Term Ideas

Not committed work — directions worth considering.

- **In-process generation.** Today the web UI spawns the CLI (`node . --flags`) for every generation
  and polls a separate progress server. Now that everything is ESM with a shared `common.js`, the
  server could call `run()`/`upscale()` in-process (with a job queue + streamed progress), removing the
  child-process round-trip and the second HTTP server. Bigger change; weigh the isolation benefit of the
  current design.
- **Real test suite + CI.** A committed `npm test`, a small fixture `output/`, mocked `fetch` for the
  WebUI contract, and a GitHub Actions workflow running lint + tests on Node 24. See
  [`testing.md`](testing.md).
- **Frontend modernization.** Convert `web/frontend/*` from classic multi-`<script>` jQuery code to ES
  modules (and maybe drop jQuery/lodash-in-the-browser), with proper linting.
- **TypeScript or JSDoc types.** The settings objects and the dynamic-prompt/prompt-module contracts
  are implicit; typing them would make the plugin API self-documenting and catch shape mistakes.
- **Pluggable backends.** The tool is hard-wired to the Stable Diffusion WebUI `--api`. A thin adapter
  layer could support other local backends.
- **Packaging.** A proper `bin` entry / npx-able CLI, and clearer separation of user data (`output/`,
  `user-settings.json`) from the app.
