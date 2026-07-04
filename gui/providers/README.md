# Image providers

Each image provider is a self-contained folder, auto-discovered by `index.js` (it globs every
`*/config.js`). Drop a folder in and it registers — no central edit.

## Support ladder (a provider supports whichever rung it reaches)

- **api** — a callable endpoint; we render the image for you (`code/generate.js`, optional
  `code/server.js` for hosted providers).
- **syntax** — no API, but a real prompt grammar; we emit the tool's dialect + parameters
  (`code/format.js`) and the UI offers **Copy prompt**.
- **plain** — no API, no grammar; the engine's `plain` dialect renders emphasis as words.

## Folder layout

```
<id>/
  config.js     manifest: id, label, tier, dialect, transport, local, needsKey, capabilities, loaders
  settings.js   provider-owned settings schema { defaults, fields, data? }
  presets/      provider-owned presets (optional; user presets persist via gui/storage)
  code/
    generate.js client adapter — local-direct calls the server directly; hosted posts to /api/generate
    server.js   hosted only — the upstream call, run inside the proxy (never in the browser)
    format.js   optional prompt shaping / dialect parameters
  data/         models, samplers, sizes, parameter catalogs, workflow templates, …
```

## Transports

- `local-direct` — browser → the user's own local server (no key). e.g. local-webui, comfyui.
- `hosted-proxy` — browser → `/api/generate` → upstream (BYOK). Served by the Netlify function
  online and the Vite middleware (`gui/vite-plugin-api.js`) locally — both share
  `gui/server/dispatch.js`. e.g. openai.
- `none` — syntax/plain tier; Copy-prompt, no network call. e.g. midjourney.

## Dialects

`_shared/dialects.js` maps a provider's `dialect` to the engine `mode`
(`sd`/`novelai`/`midjourney`/`plain`). Picking a provider selects the dialect — there is no
standalone "Mode" control.

## Shared settings (`_shared/settings/`)

Some settings belong to **every** generating provider, so they're declared once instead of copied
into all ~40 folders. Each is a module in `_shared/settings/` exporting a descriptor
(`{ key, applies(provider), defaultFor(provider), field(provider) }`); the folder is **auto-discovered**
(globbed) exactly like providers themselves, and `index.js#applySharedSettings` folds each applicable
one into a provider's schema at the registry (`index.js`), so the field flows to both the gear UI
(`ProviderBox`) and the flattened generation settings (`flattenForProvider`). A provider that declares
its own field with the same key keeps it (escape hatch); copy-only tiers (Plain text / syntax) get
nothing. Add a file here → it applies to all providers.

The first shared setting is **batch chunk size** (`concurrency.js`): the per-provider request
concurrency for big runs (e.g. 1000 prompts auto-generating an image batch each). The default is
metadata-derived — generous for local engines (`local` → 6), conservative for hosted APIs (→ 3, gentle
on rate limits and the browser's ~6-per-host cap), and overridable per provider via
`config.concurrencyDefault`. It applies independently to image, text (rewrite), and upscale providers;
the Home image-batch queue reads the image provider's value and rewrites go through a separate limiter
sized to the text provider's (see `gui/src/lib/home/useImageBatches.js`).

See `notes/plans/providers.md` for the full design.
