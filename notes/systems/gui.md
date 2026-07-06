# The React SPA — `targets/web/`

> **Location (flattened 2026-07-02):** the SPA lives at **`targets/web/`** (repo root). The app is **v3-only**, and
> the legacy expansion features (the "Expansions" building-block tab + the "Save as Expansion" feature)
> were removed.

A standalone **React 19 + Vite 6** single-page app (`targets/web/`, its own `package.json`). It runs the
**real prompt engine in the browser** ([core-engine.md](core-engine.md)) and generates images through a
modular, **BYOK** (bring-your-own-key) provider model. It is what `netlify.toml` builds and deploys; see
[`../reference/deployment.md`](../reference/deployment.md).

## Layout

| File | Role |
|------|------|
| `src/main.jsx` / `src/App.jsx` | Entry + shell (brand top-bar, hero, footer; opens the settings drawer). |
| `src/components/` | The UI across four top-level views — `Home` (compose + generate), `Gallery`, `SingleView`, and the `Manage` content editor — plus `ProvidersMenu`, `DplEditor`, `SettingsDrawer`/`Settings`, and `Field`. (Sub-areas are grouped under `components/{home,manage,single}/`.) The composer prompt box lives in a reusable **`PromptComposer`** (forwardRef, `insert(token)` handle, `onGenerate(text)` callback) shared by `Home` and a compact copy atop the `Gallery`. |
| `src/lib/gallery/generateIntoGallery.js` | The Gallery's own image-generation flow — streams live placeholder cells into the grid and ingests each finished image to the feed. The counterpart to `lib/home/useImageBatches.js` (which drives the Home prompt list); kept separate so the perf-critical Home path is untouched, but mirrors its rewrite passes + sidecar `meta` shape + concurrency limiter. |
| `src/lib/promptEngine.js` | Wraps `core/`'s `createEngine(browserLoader)` for the SPA. |
| `src/lib/catalog.js` | The token catalog (lists + dynamic prompts) the builder offers. |
| `src/lib/settings.js` / `customStore.js` / `share.js` | Settings, local custom tokens, shareable state. |
| `src/lib/providers/` | The generation providers (see below). |
| `src/lib/dialog.js` / `src/components/DialogHost.jsx` | In-app dialog system (see below). |

## In-app dialogs

The SPA uses **no** native `alert` / `confirm` / `prompt`. Instead, `src/lib/dialog.js` is a tiny
Promise-based external store exposing a singleton `dialog` with `alert` / `confirm` / `prompt`
(resolve contract mirrors the natives: `confirm`→boolean, `prompt`→string|null, `alert`→undefined).
A single `<DialogHost>` is mounted once at the app root (inside the i18n boundary) and renders the
active request as an accessible modal via a portal, resolving the pending promise on the user's
choice. It's a store (not React context) **on purpose**: the non-component hook/lib callers
(`lib/home/useImageBatches.js`, `lib/manage/useManageTree.js`) call `dialog.confirm(...)` the same way
a component does. Styling reuses the existing `.modal` / `.modal-overlay` / `.modal-actions` classes
(+ `.modal-input`, `.btn-destructive`). Because the formerly-synchronous natives are now Promises,
every caller `await`s — keep that in mind when adding a dialog to a previously-sync handler.

## The provider model

Generation backends are modular — the same plugin pattern the dynamic prompts use. There are ~40
**provider adapters** under `targets/web/shared/<id>/` (a shared transport in `providers/_shared/` plus one
folder per provider), registered through `targets/web/frontend/lib/providers/index.js`. Each exposes a small contract
(`id`, `label`, whether it's `local`, whether it `needsKey`, and a `generate(...)`), and
`availableProviders()` **filters out providers that can't run in the current build** — the local-only SD
backends and any provider a browser can't call directly are hidden in the **online** build
(`ONLINE` ← `VITE_ONLINE`). Add a backend by dropping a folder in `targets/web/shared/` and registering it.

Calls are **BYOK and go straight from the browser** to the chosen provider with the user's key — there is
**no server relay**. (The former serverless generate/rewrite proxy was retired; a provider a browser can't
reach is simply disabled online rather than forwarded.) The **local** edition additionally has a
server-side dispatch path — `targets/web/backend/dispatch.js` (`dispatch` / `dispatchRewrite`) behind its `/api` —
for backends better driven from Node. Stable Diffusion is still supported but is now one option among many.

## Styling

CSS lives under `targets/web/frontend/styles/` — an `index.css` entry (imported once by `main.jsx`) that declares
the `@layer` order and `@import`s a tree of focused modules: `foundation/tokens.css` (a two-tier
token system — `--p-*` primitive palette/scales → semantic `--accent`/`--bg`/`--fg`/`--dpl-*` roles)
+ `foundation/base.css`, then one `components/<section>.css` per UI area. This replaced the former
single ~5,360-line `styles.css` (the CSS overhaul — see
[`../plans/css-overhaul.md`](../plans/css-overhaul.md)); the split was verified render-identical
against the Playwright visual baseline. Theming (dark/light bases × accent presets, driven by
`data-theme`/`data-accent` on `<html>` via a `targets/web/frontend/theme/` provider) builds on this token layer.

## Build / deploy

`netlify.toml` (repo root): `npm --prefix gui install && npm --prefix gui run build` →
`targets/web/dist`, with an SPA fallback to `index.html`. The online build is **fully static** — no `/api`, no
serverless functions (BYOK calls go straight from the browser). The `/api/*` surface exists only in the
**local** edition, served by `targets/web/backend/serve.js`. Details in
[`../reference/deployment.md`](../reference/deployment.md).

`targets/web/package.json`'s `build` is `node scripts/build.mjs` (an orchestrator), not a bare `vite build`.
Locally it just runs the client build. For the **online** build (`VITE_ONLINE=true`) it additionally
prerenders — see below.

## Online prerendering (static HTML + hydration)

The online build prerenders its first paint to static HTML so the building-block palette (the Largest
Contentful Paint) is painted from HTML before any JS runs — client-rendering it with React + react-intl
on throttled mobile was the whole LCP cost (profiled: 92% render-delay). It's **online-only**; the
local build is untouched (its `#root` ships empty and mounts fresh).

- **`scripts/build.mjs`** — client build → SSR build of `src/entry-server.jsx` → call its
  `renderToString` → inject the shell/palette markup into `#root` in `dist/index.html` → drop the
  throwaway SSR bundle (`dist-ssr/`, git-ignored).
- **`src/entry-server.jsx`** — `render()` = `renderToString(<App/>)`. `renderToString` (not a headless
  snapshot) is deliberate: effects don't run, so the CodeMirror composer renders as its empty host
  `<div>` — exactly the client's first render — so hydration is clean.
- **`src/main.jsx`** — `hydrateRoot` when `#root` is populated (online), else `createRoot` (local/dev).
- **Server == client-first render.** `App` boots the **default-settings** shell online (skips the
  local blank-frame gate); the client's first render also produces defaults because the storage cache
  hydrates asynchronously. Stored settings then settle in via a **two-pass** store: `cache.onHydrated`
  fires when hydration completes, and `useSettings` / `useUserThemes` render defaults first, re-read
  stored values after, and **gate their save so the transient defaults are never persisted** (this is
  what stops a returning visitor's saved settings from being wiped — a hard requirement).
- **Invariant + guard:** the initial render path must stay SSR-safe (no `window`/`document`/… during
  render — put browser access in effects, which don't run in `renderToString`). `tests/prerender.test.js`
  renders the app in a **`node` environment** (no DOM) so any violation fails in CI, not in a deploy.
  Hydration cleanliness (0 warnings for first-time AND returning visitors) is verified with Playwright.
