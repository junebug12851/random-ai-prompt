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

See `notes/plans/providers.md` for the full design.
