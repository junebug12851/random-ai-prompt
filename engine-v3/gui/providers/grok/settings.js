/**
 * Grok (xAI) — provider-owned settings.
 * @module gui/providers/grok/settings
 */
import defaults from "./grok.json";

export default {
  defaults,
  fields: [
    {
      key: "model",
      label: "Model",
      type: "select",
      options: ["grok-2-image", "grok-imagine-image-quality"],
    },
    { key: "batchSize", label: "Images", type: "number", min: 1, max: 4 },
  ],
};
