# Image-provider framework

> Approved design + status. **Phase 1 (framework foundation) is built** on `feature/providers`
> (2.7.2). Later phases below are pending.

## The model

"Support" is **not** "has an API." Every provider is at minimum a **prompt target**. Each sits on a
support ladder, and we support whatever rung it reaches:

| Rung | Meaning | We support it by… | Examples |
|------|---------|-------------------|----------|
| **api** | Callable image endpoint | Generating the prompt **and** rendering the image | OpenAI, Stability, fal.ai, Replicate, BFL/FLUX, Ideogram, Leonardo, ComfyUI, A1111 |
| **syntax** | No public API, rich prompt **dialect** | Emitting the tool's grammar + params; Copy-prompt | Midjourney (`::`, `--ar`/`--stylize`/…), NovelAI |
| **plain** | No API, no grammar | Natural language; emphasis rendered as **words** (kept, not dropped) | the universal fallback |

Capabilities **expand/contract per provider** — never a lowest-common-denominator param blob.

## Folder layout (under `targets/web/`, per owner)

```
targets/shared/
  _shared/dialects.js                  # dialect → engine mode
  _shared/transport/{localDirect,hostedProxy,submitPoll}.js
  <id>/
    config.js     manifest: id,label,tier,dialect,transport,local,needsKey,capabilities,loaders
    settings.js   provider-owned { defaults, fields, data? }
    presets/      provider-owned presets (user presets persist via targets/web/storage)
    code/{generate.js, server.js?, format.js?}
    data/         models, samplers, sizes, parameter catalogs, workflow templates
  index.js        auto-discovery via import.meta.glob("./*/config.js")
targets/web/storage/      pluggable persistence (browser | localFile) + presetStore
targets/web/backend/dispatch.js                 # shared hosted dispatch (Netlify + Vite middleware)
targets/web/vite-plugin-api.js                 # local /api/generate + /api/storage
```

## Dialects

`_shared/dialects.js` maps `sd | novelai | midjourney | plain` → engine `settings.mode`. The provider
owns the dialect (the standalone "Mode" control is removed when the image-gen UI re-lands). `plain` is
native in `engine/helpers/randomEmphasis.js`: it keeps the engine's emphasis rolls and renders them as
natural-language intensifier/hedge words (provider-overridable via `plainEmphasisWords` /
`plainDeEmphasisWords`).

## Transport

- **local-direct** — browser → user's own server, no key (local-webui, comfyui).
- **hosted-proxy** — browser → `/api/generate` → upstream (BYOK, per-request key, never stored). Served
  by the Netlify function online and the Vite dev-middleware locally; both share `server/dispatch.js`.
  Hosted providers add a `code/server.js` upstream adapter.
- **none** — syntax/plain tier; Copy-prompt, no network.

## Storage subsystem

Parallel pluggable layer, chosen by run mode: online = stripped `localStorage`; local = real `.json`
file via `/api/storage` (browser fallback). Per-provider presets via `presetStore(providerId)`.

## Phases

1. **Framework foundation — DONE (2.7.2).** `targets/shared/` + registry + dialects (+ native `plain`) +
   storage + transport (Netlify fn + Vite middleware) + first providers (local-webui, comfyui, openai,
   midjourney). Tests: registry/Midjourney contract + plain-dialect unit.
2. **UI re-add** — provider dropdown, capability-driven settings, image results, Copy-prompt for the
   syntax tier; drop the standalone Mode control. (Image gen is in the "removed, pending re-add" bucket.)
3. **Submit/poll hosted** — Stability, fal.ai, Replicate, BFL/FLUX, Ideogram, Leonardo on `submitPoll`.
4. **Catalog breadth** — more syntax/plain targets; per-provider presets surfaced in the UI.

Exact hosted endpoint URLs / model ids are verified against each provider's live docs at build time
(offline knowledge cutoff mid-2025); the integration *shapes* (sync vs poll, key header, dialect) are
stable.
