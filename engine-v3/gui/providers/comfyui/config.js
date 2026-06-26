/**
 * ComfyUI provider — config/manifest. Talks to the user's local ComfyUI server: submit a
 * workflow **graph** to `/prompt`, poll `/history/{id}`, then read images from `/view`.
 * Local mode only; no key.
 * @module gui/providers/comfyui/config
 */
export default {
  id: "comfyui",
  label: "ComfyUI",
  tier: "api",
  dialect: "sd",
  transport: "local-direct",
  local: true,
  needsKey: false,

  capabilities: {
    negativePrompt: true,
    samplers: true,
    scheduler: true,
    steps: true,
    cfg: true,
    seed: true,
    size: "freeform",
    batch: { min: 1, max: 8 },
    checkpoint: true, // ComfyUI needs a checkpoint name (its own knob)
  },

  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
