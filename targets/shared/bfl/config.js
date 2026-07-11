/**
 * Black Forest Labs (FLUX) provider — config/manifest. Hosted, BYOK. FLUX direct from BFL; the
 * API is submit-then-poll (the proxy polls server-side via the shared submitPoll helper).
 * @module gui/providers/bfl/config
 */
export default {
  id: "bfl",
  label: "FLUX (Black Forest Labs)",
  description: "FLUX direct from Black Forest Labs.",
  keyUrl: "https://dashboard.bfl.ai/",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
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
