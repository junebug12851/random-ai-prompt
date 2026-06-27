/**
 * Stability AI provider — config/manifest. Hosted, BYOK, synchronous (returns base64). Stable
 * Image Core / SD3 / Ultra via the v2beta `stable-image/generate/{model}` endpoints.
 * @module gui/providers/stability/config
 */
export default {
  id: "stability",
  label: "Stability AI",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  capabilities: {
    models: true,
    aspectRatio: true,
    negativePrompt: true,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 1 },
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
