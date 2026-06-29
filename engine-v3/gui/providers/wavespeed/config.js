/**
 * WaveSpeed AI (Real-ESRGAN) — upscale-only enhancer. Async submit→poll
 * (`api/v3/wavespeed-ai/real-esrgan` → `api/v3/predictions/{id}/result`). Routed through the
 * `/api/upscale` proxy; local-only. Best-effort BYOK — verify against current docs.
 * @module gui/providers/wavespeed/config
 */
export default {
  id: "wavespeed",
  label: "WaveSpeed (Real-ESRGAN)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
