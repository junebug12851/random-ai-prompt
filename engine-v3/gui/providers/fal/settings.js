/**
 * fal.ai — provider-owned settings. `model` is a fal model id; `imageSize` uses fal's named
 * size presets.
 * @module gui/providers/fal/settings
 */
export default {
  defaults: { model: "fal-ai/flux/schnell", imageSize: "square_hd", batchSize: 1 },
  fields: [
    { key: "model", label: "Model", type: "select", optionsFrom: "models" },
    {
      key: "imageSize",
      label: "Size",
      type: "select",
      options: [
        "square_hd",
        "square",
        "portrait_4_3",
        "portrait_16_9",
        "landscape_4_3",
        "landscape_16_9",
      ],
    },
    { key: "batchSize", label: "Images", type: "number", min: 1, max: 4 },
  ],
  data: { models: () => import("./data/models.json").then((m) => m.default) },
};
