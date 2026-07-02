/**
 * Picsart (Upscale) — config/manifest. An upscale-only enhancer (`api.picsart.io/tools/1.0/upscale`,
 * `X-Picsart-API-Key` header, multipart `image` + `upscale_factor`, JSON `{ data: { url } }` back).
 * Runs through our `/api/upscale` proxy; local-only (single view), so never reachable online.
 * Best-effort BYOK adapter — verify against current Picsart docs.
 * @module gui/providers/picsart/config
 */
export default {
  id: "picsart",
  label: "Picsart (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
