/**
 * fal.ai provider — config/manifest. Hosted, BYOK. Runs any fal model (FLUX, SD3.5, …) via the
 * synchronous `fal.run` endpoint (no polling needed for typical fast models).
 * @module gui/providers/fal/config
 */
export default {
  id: "fal",
  label: "fal.ai",
  description: "Fast hosted inference (FLUX, SD3.5, Recraft, …).",
  keyUrl: "https://fal.ai/dashboard/keys",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  capabilities: {
    models: true,
    size: true,
    negativePrompt: false,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 4 },
    upscale: true, // fal-ai/esrgan (Real-ESRGAN ~4×), synchronous — see code/upscale.js
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
