/**
 * Venice AI (Upscale) — config/manifest. An upscale-only enhancer (`api.venice.ai/api/v1/image/upscale`,
 * Bearer auth, JSON base64 `image` + `scale` 1–4, returns the image bytes). Routed through our
 * `/api/upscale` proxy; local-only. Venice is uncensored, so no `contentPolicy` tag. Best-effort BYOK.
 * @module gui/providers/venice/config
 */
export default {
  id: "venice",
  label: "Venice AI (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
