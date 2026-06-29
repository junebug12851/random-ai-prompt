/**
 * neural.love (Upscale) — upscale-only enhancer. Async order API
 * (`v1/images/process` → `v1/images/orders/{orderId}`, Bearer). Routed through the `/api/upscale`
 * proxy; local-only. Best-effort BYOK — the request/response shape is approximate; verify live.
 * @module gui/providers/neurallove/config
 */
export default {
  id: "neurallove",
  label: "neural.love (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
