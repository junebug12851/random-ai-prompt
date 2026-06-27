/**
 * fal.ai provider — config/manifest. Hosted, BYOK. Runs any fal model (FLUX, SD3.5, …) via the
 * synchronous `fal.run` endpoint (no polling needed for typical fast models).
 * @module gui/providers/fal/config
 */
export default {
  id: "fal",
  label: "fal.ai",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
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
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
