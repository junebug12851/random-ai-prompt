# random-ai-prompt

A random AI prompt + image generator for Stable Diffusion (and other) image models. This repository
holds **two separate engines**. Pick the one you want:

## 🟢 `engine-v3/` — the active project

The current, maintained system: an isomorphic prompt **engine** (`src/core/`) authored in the **DPL**
dynamic-prompt language, driven by a React/Vite **web SPA** (`web-app/`), with SFW/NSFW gating and the
improved keyword lists. **All new work happens here.** It contains the `v1`/`v2`/`v3` dynamic-prompt
generations, re-wired to the new lists.

```sh
cd engine-v3
npm install
npm run web         # run the SPA (dev server)
npm test            # lint + smoke + Vitest (Node + jsdom)
npm run web:build   # production SPA build
```

## 🟠 `engine-v1-2/` — the original, frozen

The **complete, pre-revival** system as it was in 2022–2023 (CommonJS): the yargs CLI + the Express/Pug
classic web UI. It is **finished and frozen** — kept here as a self-contained, runnable reference, and is
on its way out (it will eventually be removed). It is **not** maintained, built, or released, and shares
**no code** with `engine-v3/`.

```sh
cd engine-v1-2
npm install
node index.js       # CLI generator
node server.js      # classic web UI (or: webui.bat)
```

## Repo-level

- `notes/` — the living documentation system (start at `notes/status.md`).
- `CLAUDE.md` — AI/context guide for the repo.
- CI builds and tests **`engine-v3/` only**.

Open source by junebug12851. Licensed under Apache-2.0.
