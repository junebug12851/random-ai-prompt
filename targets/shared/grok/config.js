/**
 * Grok (xAI) provider — config/manifest. Hosted, BYOK. Image generation via the OpenAI-compatible
 * `api.x.ai/v1/images/generations` endpoint (Aurora / grok-2-image).
 * @module gui/providers/grok/config
 */
export default {
  id: "grok",
  label: "Grok (xAI image)",
  description: "xAI Grok / Aurora image generation.",
  keyUrl: "https://console.x.ai/",
  // Text (prompt-rewrite) role uses the Grok chat model, not the Aurora image model.
  rewriteLabel: "Grok (xAI · Grok 2)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  keyHint: "xai-…",
  capabilities: {
    models: true,
    negativePrompt: false,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 4 },
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
  loadRewrite: () => import("./code/rewrite.js").then((m) => m.default),
};
