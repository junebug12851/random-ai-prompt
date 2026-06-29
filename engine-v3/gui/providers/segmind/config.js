/**
 * Segmind (ESRGAN) — config/manifest. An upscale-only enhancer (`api.segmind.com/v1/esrgan`,
 * `x-api-key` header, JSON `{ image: <base64>, scale }`, returns the image **bytes**). Runs through
 * our `/api/upscale` proxy; local-only. Best-effort BYOK adapter — verify against current Segmind docs.
 * @module gui/providers/segmind/config
 */
export default {
  id: "segmind",
  label: "Segmind (ESRGAN)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
