# Web Migration Plan — React + Vite SPA, online + local

The plan to turn this from a localhost-only Node tool into a **React + Vite single-page app** that runs
**online (bring-your-own-key) or locally**, hosted on **Netlify**, storing nothing on the server.
Decided across a design discussion on 2026-06-18; see [`../decisions/architecture.md`](../decisions/architecture.md)
for the rationale on each choice.

## Target architecture

```
                         ┌─────────────────────────────┐
                         │   React + Vite SPA (static)  │   ← the app; runs in the browser
                         │   - prompt engine (browser)  │
                         │   - settings in localStorage │
                         │   - provider modules (BYOK)  │
                         └──────────────┬──────────────┘
                                        │ image generation
                  ┌─────────────────────┴───────────────────────┐
                  │ online: hosted provider                       │ local: own WebUI
                  ▼                                               ▼
        ┌─────────────────────┐                       ┌───────────────────────┐
        │ Netlify function    │  (stateless proxy:    │ Stable Diffusion WebUI │
        │ /api/generate       │   forwards user key,  │ 127.0.0.1 (--api,CORS) │
        │ submit→poll, no log │   stores/logs nothing)│ called directly         │
        └─────────────────────┘                       └───────────────────────┘
```

Core principles (locked):

- **No server state.** No accounts, no database, no image storage. Generated images go straight to the
  user's browser; if they leave or clear it, that's fine. Settings live in **`localStorage`**.
- **BYOK, modular providers.** Image generation is a set of provider modules behind one interface; the
  user supplies their own API key per provider. This is the same plugin pattern the blocks
  already use.
- **Online = local with the local-only bits disabled.** One codebase; a build/runtime flag turns off
  the modules that need a local machine (local WebUI discovery, filesystem browsing, ImageMagick,
  "open folder").
- **Stateless proxy only when needed.** Hosted provider APIs usually block direct browser calls (CORS /
  server-side keys), so a thin Netlify function forwards `{prompt, key, params}`, polls the provider,
  returns the image, and **logs/stores nothing**. Local mode skips the proxy and calls the WebUI
  directly. Keys are never bundled into client JS and never persisted server-side.
- **Host: Netlify** (static SPA + functions). Cloudflare Pages is the drop-in scale option (roomier free
  bandwidth). Near-zero lock-in since nothing is stored.

## The central refactor: a browser-safe prompt core

The clever part of this app — the block / list / expansion pipeline — is pure text logic, but
today it hard-depends on Node: `fs.readFileSync` for `lists/*.txt` + `expansions/*.txt`, and
`createRequire` for `blocks/*.js`. The browser has neither.

**Plan:** extract the engine into a `core/` that takes its data through an injected **loader interface**
instead of calling `fs`/`require` directly:

```
core/                         framework-agnostic prompt engine (no fs/require inside)
  pipeline, cleanup, list, expansion, prompt-salt, block expansion
  loader interface: { listNames(), readList(name), expansionNames(), readExpansion(name),
                      blockNames(), loadBlock(name) -> { default, full, ... } }

loaders/
  node-loader.js     fs + createRequire (used by the CLI / local server)
  browser-loader.js  Vite import.meta.glob: bundles blocks/**.js (they're already ESM
                     default-export modules!) and lists/expansions/*.txt as ?raw assets
```

Because the blocks are already `export default function (...)` ES modules, Vite's
`import.meta.glob` can bundle every one at build time — no `fs`, no `require` in the browser. The CLI
keeps the Node loader; the SPA uses the browser loader. Same engine, two data sources.

## Migration phases (keep the old app working throughout)

1. **Scaffold** `web-app/` (Vite + React), ESLint, `netlify.toml`, app shell, settings in localStorage.
   Build-verified. *(in progress)*
2. **Provider abstraction + Netlify proxy.** Define the image-provider interface + a stub provider; a
   stateless `netlify/functions/generate` that does submit→poll and logs nothing. A "local WebUI"
   provider that calls `127.0.0.1` directly. Settings UI to enter/keep keys in localStorage.
3. **Browser-safe core.** Extract the engine + the loader interface; write `browser-loader.js`
   (`import.meta.glob`). Get prompt generation/expansion running **in the browser** with the real
   blocks + lists + expansions.
4. **Views, one at a time** (so the old UI keeps working until parity): Generate → Prompt result →
   Image result/gallery (in-memory only) → Settings editor → Dynamic-prompt / preset browser. Make it a
   **PWA** (manifest + service worker) for the native feel.
5. **Retire Express.** Once the SPA + proxy cover generation and the (in-browser) prompt logic, the old
   `server.js` / `web/` and most endpoints are unnecessary — they were file/index/generation glue. Keep
   the **CLI** (it shares `core/` via the Node loader). Drop `express`, `pug`, the image index, and the
   local file-management endpoints from the runtime path.

## What stays, what goes

- **Stays:** the prompt engine (now in `core/`), the blocks / lists / expansions / presets data,
  the CLI (via the Node loader).
- **Goes (eventually):** `server.js` + `web/` (old Pug/jQuery UI), the Express dependency, the
  server-side image index and local file-management/animation/magick endpoints (online stores nothing;
  local power-features become optional/local-only).

## Open questions to settle as we go

- Which hosted providers to ship first as modules (e.g. a generic "SD WebUI-compatible" + one hosted
  API). Each is a small module implementing the interface.
- Whether to keep animations/upscales in v1 of the SPA or defer (they lean on local file handling).
- PWA scope (installable + offline shell is easy; offline generation is not, since it needs a provider).
