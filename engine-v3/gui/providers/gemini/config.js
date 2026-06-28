/**
 * Google Gemini provider — config/manifest. Hosted, BYOK. Image generation via the Gemini
 * `generateContent` API ("Nano Banana" image models; Imagen retires Aug 2026). Returns base64.
 * @module gui/providers/gemini/config
 */
export default {
  id: "gemini",
  label: "Google Gemini (image)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  capabilities: {
    models: true,
    negativePrompt: false,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 1 },
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
  loadRewrite: () => import("./code/rewrite.js").then((m) => m.default),
};
