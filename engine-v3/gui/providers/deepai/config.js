/**
 * DeepAI (Super Resolution) — config/manifest. An **upscale-only / enhancer** provider: it has no
 * text-to-image generation, only a single REST super-resolution endpoint (`api/torch-srgan`). So it
 * never appears in the image-generation picker — only in the Upscaler / Enhancer row + the single
 * view's AI-upscale menu. Runs through our `/api/upscale` proxy (server-side), which sidesteps
 * browser CORS and inlines the local image.
 *
 * CORS: DeepAI ships an official browser client (so it's CORS-open / web-browser compatible), but we
 * proxy it anyway for uniform image inlining + result fetching. Because upscaling only happens in the
 * local-only single view, this provider is never reachable in the online build regardless.
 * @module gui/providers/deepai/config
 */
export default {
  id: "deepai",
  label: "DeepAI (Super Resolution)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
