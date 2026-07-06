# Future / Longer-Term Ideas

Not committed work — directions worth considering.


- **Real test suite + CI.** A committed `npm test`, a small fixture `output/`, mocked `fetch` for the
  WebUI contract, and a GitHub Actions workflow running lint + tests on Node 24. See
  [`testing.md`](testing.md).
- **Frontend modernization.** Convert `web/frontend/*` from classic multi-`<script>` jQuery code to ES
  modules (and maybe drop jQuery/lodash-in-the-browser), with proper linting.
- **TypeScript or JSDoc types.** The settings objects and the block/prompt-module contracts
  are implicit; typing them would make the plugin API self-documenting and catch shape mistakes.
- **Pluggable backends.** The tool is hard-wired to the Stable Diffusion WebUI `--api`. A thin adapter
  layer could support other local backends.
- **Packaging.** A proper `bin` entry / npx-able CLI, and clearer separation of user data (`output/`,
  `user-settings.json`) from the app.
