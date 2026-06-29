# random-ai-prompt

[![Netlify Status](https://api.netlify.com/api/v1/badges/927e1b3b-338c-48e0-8959-03dcd055cb87/deploy-status)](https://app.netlify.com/projects/prompt-fairyfox/deploys)

A random AI prompt + image generator for Stable Diffusion (and other) image models. This repository
holds **two separate engines**. Pick the one you want:

## 🟢 `engine-v3/` — the active project

The current, maintained system: an isomorphic prompt **engine** (`src/core/`) authored in the **DPL**
dynamic-prompt language, driven by a React/Vite **web SPA** (`gui/`), with SFW/NSFW gating and the
improved keyword lists. **All new work happens here.** It contains the `v1`/`v2`/`v3` dynamic-prompt
generations, re-wired to the new lists.

### Build & run from source

Requires **Node ≥ 24**.

```sh
cd engine-v3
npm install          # installs the engine and the gui/ web-app dependencies
npm run web          # run the app (opens a local web server)
```

The engine and the SPA in `gui/` are separate packages; `npm install` installs both (the engine's
`postinstall` runs the gui install for you). To reinstall just the web-app deps, run `npm run web:install`.

To produce a static production build instead of running the dev server:

```sh
npm run web:build    # outputs the built site to gui/dist/
```

### Development

Contributing? The verification gate is `npm test` (lint + smoke + Vitest, Node + jsdom); end-to-end
specs run with `npm run test:e2e`. See [`notes/`](notes/) (start at
[`notes/status.md`](notes/status.md)) for the full developer guide.

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
