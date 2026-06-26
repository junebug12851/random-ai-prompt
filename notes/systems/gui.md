# The React SPA — `gui/`

> **Location (2026-06-25):** the SPA now lives at **`engine-v3/gui/`** (engine-v3 is the single active
> project). engine-v3 is **v3-only**, and the legacy expansion features (the "Expansions" building-block
> tab + the "Save as Expansion" feature) were removed. See [`../plans/engine-split.md`](../plans/engine-split.md).

A standalone **React 19 + Vite 6** single-page app (`gui/`, its own `package.json`). It runs the
**real prompt engine in the browser** ([core-engine.md](core-engine.md)) and generates images through a
modular, **BYOK** (bring-your-own-key) provider model. It is what `netlify.toml` builds and deploys; see
[`../reference/deployment.md`](../reference/deployment.md).

## Layout

| File | Role |
|------|------|
| `src/main.jsx` / `src/App.jsx` | Entry + shell (brand top-bar, hero, footer; opens the settings drawer). |
| `src/components/` | `Home` (the unified compose-and-generate page), `SettingsDrawer` (slide-over wrapping `Settings`), `Settings`, `Field`, `Gallery` — the UI. (The old separate `Builder` / `Generate` were folded into `Home` in 2.0.2.) |
| `src/lib/promptEngine.js` | Wraps `core/`'s `createEngine(browserLoader)` for the SPA. |
| `src/lib/catalog.js` | The token catalog (lists / expansions / dynamic prompts) the builder offers. |
| `src/lib/settings.js` / `customStore.js` / `share.js` | Settings, local custom tokens, shareable state. |
| `src/lib/providers/` | The generation providers (see below). |

## The provider model

Generation backends are modular — the same plugin pattern the dynamic prompts use. Each provider
implements `{ id, label, local, needsKey, generate({prompt, settings, key, signal}) -> {images} }`:

- **`localWebui`** — calls the user's own SD WebUI directly from the browser (`local: true`).
- **`hostedProxy`** — BYOK: posts to the Netlify function, which forwards to a hosted image API.

`providers/index.js` registers them and exposes `availableProviders()`, which **filters out local-only
providers when deployed online** (`ONLINE` ← `VITE_ONLINE` env var) — one codebase serves both the local
and the hosted build. Add a backend by dropping a module in `providers/` and registering it.

## The Netlify function — `gui/netlify/functions/generate.js`

A **stateless BYOK proxy**: receives `{prompt, key, params}`, forwards to the chosen hosted API, polls
until ready (submit→poll keeps each invocation within serverless time limits), returns image URLs.
**Stores nothing; must never log the key.** The hosted-provider dispatch is the wiring point for
migration phase 2 (currently a deliberate stub). Local generation never touches this function — the
browser calls the user's WebUI directly.

## Build / deploy

`netlify.toml` (repo root): `npm --prefix gui install && npm --prefix gui run build` →
`gui/dist`, with `/api/*` routed to the functions and an SPA fallback to `index.html`. Details in
[`../reference/deployment.md`](../reference/deployment.md).
