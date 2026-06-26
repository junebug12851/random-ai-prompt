/**
 * Local Stable Diffusion WebUI — provider-owned settings schema + defaults. The
 * capability-driven UI renders `fields`; `defaults` seed a fresh install.
 * @module gui/providers/local-webui/settings
 */
export default {
  defaults: {
    localWebuiUrl: "http://127.0.0.1:7860",
    sampler: "Euler",
    imageSteps: 32,
    cfg: 11,
    imageWidth: 512,
    imageHeight: 512,
    seed: -1,
    negativePrompt: "",
  },
  fields: [
    { key: "localWebuiUrl", label: "WebUI URL", type: "text" },
    { key: "sampler", label: "Sampler", type: "select", optionsFrom: "samplers" },
    { key: "imageSteps", label: "Steps", type: "number", min: 1, max: 150 },
    { key: "cfg", label: "CFG scale", type: "number", min: 1, max: 30, step: 0.5 },
    { key: "imageWidth", label: "Width", type: "number", min: 64, max: 2048, step: 64 },
    { key: "imageHeight", label: "Height", type: "number", min: 64, max: 2048, step: 64 },
    { key: "seed", label: "Seed (-1 = random)", type: "number" },
    { key: "negativePrompt", label: "Negative prompt", type: "text" },
  ],
  data: {
    samplers: () => import("./data/samplers.json").then((m) => m.default),
  },
};
