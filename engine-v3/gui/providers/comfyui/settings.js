/**
 * ComfyUI — provider-owned settings schema + defaults. Includes ComfyUI-specific knobs
 * (server URL, checkpoint name, scheduler) the other providers don't have.
 * @module gui/providers/comfyui/settings
 */
export default {
  defaults: {
    comfyUrl: "http://127.0.0.1:8188",
    comfyCheckpoint: "",
    sampler: "euler",
    scheduler: "normal",
    imageSteps: 20,
    cfg: 7,
    imageWidth: 512,
    imageHeight: 512,
    batchSize: 1,
    seed: -1,
    negativePrompt: "",
  },
  fields: [
    { key: "comfyUrl", label: "ComfyUI URL", type: "text" },
    { key: "comfyCheckpoint", label: "Checkpoint (.safetensors)", type: "text" },
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
