/**
 * Stability AI provider — config/manifest. Hosted, BYOK, synchronous (returns base64). Stable
 * Image Core / SD3 / Ultra via the v2beta `stable-image/generate/{model}` endpoints.
 * @module gui/providers/stability/config
 */
export default {
  id: "stability",
  label: "Stability AI",
  description: "Stability AI — Stable Image Core / SD3 / Ultra.",
  keyUrl: "https://platform.stability.ai/account/keys",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  keyHint: "sk-…",
  // Built for safe-for-work content. Never hard-blocked — soft-locked (icon + confirm) in NSFW mode.
  contentPolicy: "sfw-only",
  capabilities: {
    models: true,
    aspectRatio: true,
    negativePrompt: true,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 1 },
    upscale: true, // v2beta fast upscaler (~4×), synchronous — see code/upscale.js
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
