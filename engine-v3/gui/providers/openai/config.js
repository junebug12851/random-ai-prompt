/**
 * OpenAI Images provider — config/manifest. Hosted, BYOK, synchronous. Natural-language
 * (`plain`) dialect: SD weighting syntax doesn't apply, so emphasis is rendered as words.
 * The browser calls our proxy (`/api/generate`), which forwards to the OpenAI Images API.
 * @module gui/providers/openai/config
 */
export default {
  id: "openai",
  label: "OpenAI (DALL·E / gpt-image)",
  // Shown when this provider is picked for the TEXT (prompt-rewrite) role — the rewrite uses a
  // GPT chat model, not the image model, so the image-flavoured label would be misleading here.
  rewriteLabel: "OpenAI (GPT-4o mini)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  // Built for safe-for-work content. Never hard-blocked — soft-locked (icon + confirm) in NSFW mode.
  contentPolicy: "sfw-only",

  capabilities: {
    negativePrompt: false, // OpenAI has no negative-prompt concept
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    size: ["1024x1024", "1536x1024", "1024x1536"],
    models: ["gpt-image-1", "dall-e-3"],
    batch: { min: 1, max: 10 },
  },

  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
  loadRewrite: () => import("./code/rewrite.js").then((m) => m.default),
};
