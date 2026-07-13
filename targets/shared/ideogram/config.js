/**
 * Ideogram provider — config/manifest. Hosted, BYOK. Known for strong in-image text rendering.
 * NOTE: Ideogram's API has shifted across versions; this targets the v2 JSON `/generate` endpoint
 * and may need adjusting for v3. (Ideogram models are also reachable via the Replicate/fal providers.)
 * @module gui/providers/ideogram/config
 */
export default {
  id: "ideogram",
  label: "Ideogram",
  description: "Ideogram — best in-image text rendering.",
  keyUrl: "https://ideogram.ai/manage-api",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  keyHint: "ideogram key",
  // Built for safe-for-work content. Never hard-blocked — soft-locked (icon + confirm) in NSFW mode.
  contentPolicy: "sfw-only",
  capabilities: {
    models: true,
    aspectRatio: true,
    negativePrompt: false,
    samplers: false,
    steps: false,
    cfg: false,
    seed: false,
    batch: { min: 1, max: 1 },
  },
  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
