/**
 * VanceAI (Upscale) — upscale-only enhancer. Async unified jobs API (`POST /v1/jobs` →
 * `GET /v1/jobs/{id}` → `GET /v1/jobs/{id}/result`, Bearer). Routed through the `/api/upscale`
 * proxy; local-only. Best-effort BYOK — the job request schema is approximate; verify live.
 * @module gui/providers/vanceai/config
 */
export default {
  id: "vanceai",
  label: "VanceAI (Upscale)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  upscaleOnly: true,
  capabilities: { upscale: true },
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
};
