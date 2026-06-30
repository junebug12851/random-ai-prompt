/**
 * Replicate — provider-owned settings. `model` is a Replicate model slug (owner/name); the
 * server adapter posts to that model's endpoint.
 * @module gui/providers/replicate/settings
 */
import defaults from "./replicate.json";

export default {
  defaults,
  fields: [
    { key: "model", label: "Model", type: "select", optionsFrom: "models" },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    },
    { key: "batchSize", label: "Images", type: "number", min: 1, max: 4 },
  ],
  data: { models: () => import("./data/models.json").then((m) => m.default) },
};
