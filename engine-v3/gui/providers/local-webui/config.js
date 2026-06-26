/**
 * Local Stable Diffusion WebUI provider — config/manifest. Calls the user's OWN WebUI
 * (A1111/Forge/SD.Next, started with `--api` + CORS) directly from the browser. Local
 * mode only; no key, no proxy.
 * @module gui/providers/local-webui/config
 */
export default {
  id: "local-webui",
  label: "Local Stable Diffusion WebUI",
  tier: "api",
  dialect: "sd",
  transport: "local-direct",
  local: true,
  needsKey: false,

  // The capability surface the UI renders from (expands/contracts per provider).
  capabilities: {
    negativePrompt: true,
    samplers: true,
    steps: true,
    cfg: true,
    seed: true,
    size: "freeform",
    batch: { min: 1, max: 8 },
  },

  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
