/**
 * ComfyUI — provider-owned settings schema + defaults. Includes ComfyUI-specific knobs
 * (server URL, checkpoint name, scheduler) the other providers don't have.
 * @module gui/providers/comfyui/settings
 */
// Defaults are the literal sidecar (comfyui.json); fields/data stay here. Note: comfyUpscaleModel
// is the `upscale_models/*` name for AI upscale — blank self-heals to the first installed model.
import defaults from "./comfyui.json";

export default {
  defaults,
  fields: [
    { key: "comfyUrl", label: "ComfyUI URL", type: "text" },
    { key: "comfyCheckpoint", label: "Checkpoint (.safetensors)", type: "text" },
    { key: "comfyUpscaleModel", label: "Upscale model (blank = auto)", type: "text" },
    { key: "sampler", label: "Sampler", type: "select", optionsFrom: "samplers" },
    { key: "scheduler", label: "Scheduler", type: "select", optionsFrom: "schedulers" },
    { key: "imageSteps", label: "Steps", type: "number", min: 1, max: 150 },
    { key: "cfg", label: "CFG scale", type: "number", min: 1, max: 30, step: 0.5 },
    { key: "imageWidth", label: "Width", type: "number", min: 64, max: 2048, step: 64 },
    { key: "imageHeight", label: "Height", type: "number", min: 64, max: 2048, step: 64 },
    { key: "batchSize", label: "Batch size", type: "number", min: 1, max: 8 },
    { key: "seed", label: "Seed (-1 = random)", type: "number" },
    { key: "negativePrompt", label: "Negative prompt", type: "text" },
  ],
  data: {
    samplers: () => import("./data/samplers.json").then((m) => m.default),
    schedulers: () => import("./data/schedulers.json").then((m) => m.default),
  },
};
