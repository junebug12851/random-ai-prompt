/**
 * SD.Next provider — config/manifest. SD.Next is A1111-`sdapi`-compatible, so it reuses the Local
 * WebUI adapter + settings (distinct label; point the URL at your SD.Next server). Local mode only.
 * @module gui/providers/sdnext/config
 */
export default {
  id: "sdnext",
  label: "SD.Next",
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
  },
  loadGenerate: () => import("../local-webui/code/generate.js").then((m) => m.default),
  loadSettings: () => import("../local-webui/settings.js").then((m) => m.default),
};
