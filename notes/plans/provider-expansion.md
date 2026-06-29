# Provider expansion — AI upscale + new generation/text providers

Owner request (2026-06-29): broaden provider support. Assess each provider's real capabilities and
wire **text** (prompt/keyword rewrite), **image** (generation), and **upscale** where supported — not
just upscale. NSFW: providers whose ToS are safe-for-work-only get a **soft lock** (icon + tooltip +
a "proceed?" confirm) when NSFW mode is on — never a hard block, and never tell the user no
(implemented Phase 1 via `lib/contentPolicy.js` + `contentPolicy: "sfw-only"` on configs).

## Phase 1 — DONE (framework + NSFW soft-lock)

- `capabilities.upscale` + `loadUpscale` adapter contract; `App.upscaleImage` ingests the result as a
  tracked `resize`-kind child (Resizes strip, live placeholder). `SingleView` lists every provider
  with an upscale adapter in the resize menu's **AI** group (key-gated). Dormant until a provider
  ships `loadUpscale`.
- NSFW content-policy soft-lock across the Providers picker + the generate / derive / upscale paths.
  Tagged SFW-only: `openai`, `gemini`, `ideogram`, `stability`.

## Capability assessment (from the owner's list)

Adapter shape per provider folder: `config.js` (manifest + capabilities), `settings.js` (schema),
`code/{generate,rewrite,upscale,server}.js`. Transports: `browser-direct` (CORS-OK) / `hosted-proxy`
(needs our `/api/generate` proxy) / `local-direct`. **All external endpoints below must be verified
against current docs before coding — APIs drift.**

### Already in repo — add `upscale` (fastest)

| Provider | Has now | Add | Endpoint to verify |
|---|---|---|---|
| Stability AI | image, text | **upscale** (conservative / creative / fast) | `v2beta/stable-image/upscale/*` |
| fal | image | **upscale** (Topaz, Real-ESRGAN, clarity) | `fal-ai/topaz/upscale/image`, ESRGAN models |
| Replicate | image | **upscale** (Real-ESRGAN, SwinIR, SD x4) | predictions API + model version (async poll) |
| Leonardo | image | **upscale** (Universal Upscaler) | `createVariationUpscale` |
| ComfyUI / local-webui / forge / sdnext | image (local) | **upscale** via local nodes / Extras tab | local graph / `/sdapi/v1/extra-single-image` |

### New hosted providers — generation and/or upscale

- **Generation-capable (also upscale):** Krea (gen + 2/4/8/16× upscale), Ideogram v3 (already a thin
  provider — upgrade), Adobe Firefly (gen + upscale; SFW-only).
- **Upscale-only services (new modules):** Topaz Labs, Magnific (creative, up to 16K), Clipdrop/Jasper,
  Claid.ai / Let's Enhance, Picsart, Pixelbin / Upscale.media (≤8×), Cloudinary, DeepAI Super-Resolution,
  Deep-Image.ai, VanceAI, neural.love, Venice (2×/4×), Slazzer, API4AI, Segmind ESRGAN, WaveSpeed
  Real-ESRGAN, RunPod (self-deployed).

### Local / self-host upscalers (no key)

Real-ESRGAN (NCNN exe / Python), Upscayl, waifu2x, SwinIR/Swin2SR, chaiNNer, BasicSR, HF endpoints —
wire as `local-direct` upscale adapters (shell/HTTP to a local service).

## NSFW tagging (content-policy) — `contentPolicy: "sfw-only"` candidates

Confident SFW-only (tagged): OpenAI, Gemini, Ideogram, Stability. To assess per current ToS: Adobe
Firefly (SFW), Topaz/Magnific/Claid/Let's Enhance/Picsart/Cloudinary/Pixelbin/DeepAI/VanceAI/neural.love
(content-neutral tools — likely no tag), Krea/Leonardo (allow more — likely no tag), Venice (uncensored
— no tag). Tag only where the provider's own policy forbids adult content.

## Suggested order

1. (done) framework + NSFW soft-lock.
2. In-repo upscale: Stability → fal → Replicate → Leonardo → local engines.
3. New generation providers: Krea, Firefly, Ideogram v3 upgrade.
4. Hosted upscale-only services in batches (Topaz, Magnific, Claid, Picsart, DeepAI, …).
5. Local upscalers (Real-ESRGAN/Upscayl/chaiNNer) as `local-direct`.

Each provider ships as its own commit with: config + settings + adapters, data lists, NSFW tag if
applicable, and a smoke/build pass (the browser glob bundles every provider, so `npm --prefix gui run
build` must stay green).
