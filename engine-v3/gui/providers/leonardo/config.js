/**
 * Leonardo AI provider — config/manifest. Hosted, BYOK. Submit-then-poll (the proxy polls
 * server-side). NOTE: Leonardo addresses models by UUID, which change over time — the listed
 * model ids may need updating from your Leonardo account.
 * @module gui/providers/leonardo/config
 */
export default {
  id: "leonardo",
  label: "Leonardo AI",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
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
