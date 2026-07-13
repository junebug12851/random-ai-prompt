/**
 * Google Gemini provider — config/manifest. Hosted, BYOK. Image generation via the Gemini
 * `generateContent` API ("Nano Banana" image models; Imagen retires Aug 2026). Returns base64.
 * @module gui/providers/gemini/config
 */
export default {
  id: "gemini",
  label: "Google Gemini (image)",
  description: "Google Gemini image generation (Nano Banana).",
  keyUrl: "https://aistudio.google.com/app/apikey",
  // Text (prompt-rewrite) role uses a Gemini text model, not the image model.
  rewriteLabel: "Google Gemini (2.0 Flash)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  keyHint: "AI…",
  // Built for safe-for-work content. Never hard-blocked — soft-locked (icon + confirm) in NSFW mode.
  contentPolicy: "sfw-only",
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
