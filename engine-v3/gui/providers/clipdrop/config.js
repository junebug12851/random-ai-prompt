/**
 * Clipdrop (Image Upscaling) — config/manifest. An upscale-only enhancer
 * (`clipdrop-api.co/image-upscaling/v1/upscale`, `x-api-key`, multipart `image_file` + `target_width`
 * + `target_height`, returns the image bytes). Routed through our `/api/upscale` proxy; local-only.
 * The server decodes the source size to compute the 4× target. Best-effort BYOK.
 * @module gui/providers/clipdrop/config
 */
export default {
  id: "clipdrop",
  label: "Clipdrop (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
