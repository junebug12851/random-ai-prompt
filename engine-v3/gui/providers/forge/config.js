/**
 * Forge WebUI provider — config/manifest. Forge speaks the same `/sdapi/v1/txt2img` contract as
 * A1111, so it reuses the Local WebUI adapter + settings (just a distinct label; set the URL to
 * your Forge server). Local mode only.
 * @module gui/providers/forge/config
 */
export default {
  id: "forge",
  label: "Forge WebUI",
  tier: "api",
  dialect: "sd",
  transport: "local-direct",
  local: true,
  needsKey: false,
  capabilities: {
    negativePrompt: true,
    samplers: true,
    steps: true,
    cfg: true,
    seed: true,
    size: "freeform",
    batch: { min: 1, max: 8 },
    upscale: true, // A1111 Extras upscaler (R-ESRGAN 4x+) — shared local-webui/code/upscale.js
  },
  loadGenerate: () => import("../local-webui/code/generate.js").then((m) => m.default),
  loadUpscale: () => import("../local-webui/code/upscale.js").then((m) => m.default),
  loadSettings: () => import("../local-webui/settings.js").then((m) => m.default),
};
