/**
 * Deep-Image.ai (Upscale) — upscale-only enhancer. `rest_api/process_result` (`x-api-key`, JSON
 * `url` + target `width`/`height`) returns a `result_url` directly when fast, else a `job` to poll.
 * Routed through the `/api/upscale` proxy; local-only. Best-effort BYOK.
 * @module gui/providers/deepimage/config
 */
export default {
  id: "deepimage",
  label: "Deep-Image.ai (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
