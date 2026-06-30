/**
 * OpenAI Images — provider-owned settings schema + defaults. Only the knobs OpenAI
 * actually supports (model, size, count); no samplers/steps/cfg/negatives.
 * @module gui/providers/openai/settings
 */
import defaults from "./openai.json";

export default {
  defaults,
  fields: [
    { key: "model", label: "Model", type: "select", optionsFrom: "models" },
    { key: "size", label: "Size", type: "select", optionsFrom: "sizes" },
    { key: "batchSize", label: "Images (n)", type: "number", min: 1, max: 10 },
  ],
  data: {
    models: () => import("./data/models.json").then((m) => m.default),
    sizes: () => import("./data/sizes.json").then((m) => m.default),
  },
};
