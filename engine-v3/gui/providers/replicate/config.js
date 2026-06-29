/**
 * Replicate provider — config/manifest. Hosted, BYOK. Runs any Replicate image model (FLUX,
 * SDXL, …) via the model endpoint with `Prefer: wait` (synchronous), so no polling needed.
 * @module gui/providers/replicate/config
 */
export default {
  id: "replicate",
  label: "Replicate",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  capabilities: {
    models: true,
    aspectRatio: true,
    negativePrompt: false,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 4 },
    upscale: true, // Real-ESRGAN via the proxy (hosted-proxy can't be browser-direct) — code/upscale.js
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
