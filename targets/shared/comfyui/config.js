/**
 * ComfyUI provider — config/manifest. Talks to the user's local ComfyUI server: submit a
 * workflow **graph** to `/prompt`, poll `/history/{id}`, then read images from `/view`.
 * Local mode only; no key.
 * @module gui/providers/comfyui/config
 */
export default {
  id: "comfyui",
  label: "ComfyUI",
  description: "Local ComfyUI — node-based SD/FLUX. Free, runs on your machine.",
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
    upscale: true, // upscale-model graph via the proxy — see code/upscale-server.js
  },

  loadGenerate: () => import("./code/generate.js").then((m) => m.default),
  loadUpscale: () => import("./code/upscale.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
