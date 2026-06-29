/**
 * Claid.ai / Let's Enhance (Upscale) — upscale-only enhancer. Synchronous multipart upload
 * (`v1/image/edit/upload`, Bearer, `restorations.upscale: "smart_enhance"`, returns the output's
 * temporary URL). Routed through the `/api/upscale` proxy; local-only. Best-effort BYOK.
 * @module gui/providers/claid/config
 */
export default {
  id: "claid",
  label: "Claid / Let's Enhance",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
