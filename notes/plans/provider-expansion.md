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

| Provider | Has now | Add | Status / endpoint |
|---|---|---|---|
| Stability AI | image, text | **upscale** | ✅ DONE (2.18.1) — `v2beta/stable-image/upscale/fast` (sync ~4×) |
| fal | image | **upscale** | ✅ DONE (2.18.2) — `fal-ai/esrgan` (sync ~4×), data-URI in / data-URL out |
| Leonardo | image | **upscale** (Universal Upscaler) | ✅ DONE (2.19.0) — `init-image` presigned upload → `variations/universal-upscaler` (≤2×) → poll; best-effort, verify live |
| Replicate | image | **upscale** (Real-ESRGAN) | ✅ DONE (2.19.0) — via the new `/api/upscale` proxy: `dispatchUpscale` → `nightmareai/real-esrgan` `/v1/models/.../predictions` w/ `Prefer: wait`; server inlines the image + returns data URLs |
| ComfyUI / local-webui / forge / sdnext | image (local) | **upscale** via local nodes / Extras tab | ⛔ DEFERRED — **the A1111/local-webui adapter is stale** (owner flag, 2026-06-29): the `local-webui` generate adapter (which Forge + SD.Next reuse) is old and likely no longer works against current A1111/Forge/SD.Next, so building an Extras upscaler (`/sdapi/v1/extra-single-image`) on it isn't trustworthy. **Blocked on a `local-webui` modernization pass** (re-verify the `/sdapi/v1/txt2img` contract — e.g. `sampler_index` → `sampler_name`, current param names — against a live WebUI) before the local upscaler is added. ComfyUI upscale separately needs a model-specific graph. |

**Save-model note:** the AI-upscale result must come back as a `data:` URL (the `/api/image` ingest
only persists data/localhost sources, for SSRF safety), so each adapter inlines the **input** image as
a data URI and fetches the provider-CDN **output** back into a data URL (Stability already returns
base64; fal fetches its CDN result — CORS-open). A CDN-host allowlist on the ingest endpoint would let
adapters return remote URLs directly — a possible future simplification.

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
2. (done) In-repo upscale: Stability, fal, Leonardo, Replicate (2.18.1–2.19.0).
3. (in progress) Hosted upscale-only enhancers: DeepAI (2.20.0), Picsart + Segmind (2.21.0). Remaining
   (Topaz, Magnific, Claid, Clipdrop, Pixelbin, VanceAI, neural.love, …) are mostly **async / niche /
   best-effort** — diminishing returns; add on request.
4. ⛔ Local SD upscalers (ComfyUI / Forge / SD.Next) — **DEFERRED**: the local-webui A1111 adapter is
   stale (owner flag). Needs a modernization + live re-verify pass first (see the table above).
5. New generation providers: Krea, Firefly, Ideogram v3 upgrade (real value, online-capable, but each a
   researched best-effort BYOK module).
5. Local upscalers (Real-ESRGAN/Upscayl/chaiNNer) as `local-direct`.

Each provider ships as its own commit with: config + settings + adapters, data lists, NSFW tag if
applicable, and a smoke/build pass (the browser glob bundles every provider, so `npm --prefix gui run
build` must stay green).
