/**
 * UI metadata for the provider picker: a one-line description per provider and, for BYOK
 * providers, roughly where to get an API key. Keyed by provider id.
 * @module gui/lib/providerMeta
 */
export const PROVIDER_META = {
  // Local
  forge: { description: "Local Forge WebUI (Stable Diffusion). Free, runs on your machine." },
  sdnext: { description: "Local SD.Next (Stable Diffusion). Free, runs on your machine." },
  comfyui: { description: "Local ComfyUI — node-based SD/FLUX. Free, runs on your machine." },

  // Online — BYOK image APIs
  openai: {
    description: "OpenAI DALL·E / gpt-image — strong prompt following.",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  replicate: {
    description: "Hosted open models (FLUX, SDXL, SD3.5, …) selected by slug.",
    keyUrl: "https://replicate.com/account/api-tokens",
  },
  fal: {
    description: "Fast hosted inference (FLUX, SD3.5, Recraft, …).",
    keyUrl: "https://fal.ai/dashboard/keys",
  },
  stability: {
    description: "Stability AI — Stable Image Core / SD3 / Ultra.",
    keyUrl: "https://platform.stability.ai/account/keys",
  },
  gemini: {
    description: "Google Gemini image generation (Nano Banana).",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  grok: {
    description: "xAI Grok / Aurora image generation.",
    keyUrl: "https://console.x.ai/",
  },
  bfl: {
    description: "FLUX direct from Black Forest Labs.",
    keyUrl: "https://dashboard.bfl.ai/",
  },
  ideogram: {
    description: "Ideogram — best in-image text rendering.",
    keyUrl: "https://ideogram.ai/manage-api",
  },
  leonardo: {
    description: "Leonardo AI — game / concept-art models.",
    keyUrl: "https://app.leonardo.ai/api-access",
  },

  // Online — copy-prompt (no API)
  midjourney: { description: "No API — copies a full Midjourney prompt to paste into Discord." },
  novelai: { description: "No API — copies a NovelAI-dialect prompt." },
  plain: { description: "No API — copies a plain-text prompt for any tool." },
};

/**
 * @param {string} id Provider id.
 * @returns {{ description?: string, keyUrl?: string }}
 */
export const metaFor = (id) => PROVIDER_META[id] || {};
