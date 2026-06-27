/**
 * Leonardo AI — provider-owned settings. `model` is a Leonardo model UUID (labeled).
 * @module gui/providers/leonardo/settings
 */
export default {
  defaults: {
    model: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
    imageWidth: 1024,
    imageHeight: 1024,
    batchSize: 1,
  },
  fields: [
    {
      key: "model",
      label: "Model",
      type: "select",
      options: [
        { value: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", label: "Leonardo Phoenix 1.0" },
        { value: "b24e16ff-06e3-43eb-8d33-4416c2d75876", label: "Leonardo Lightning XL" },
        { value: "1e60896f-3c26-4296-8ecc-53e2afecc132", label: "Leonardo Diffusion XL" },
        { value: "e71a1c2f-4f80-4800-934f-2c68979d8cc8", label: "Leonardo Anime XL" },
      ],
    },
    { key: "imageWidth", label: "Width", type: "number", min: 512, max: 1536, step: 64 },
    { key: "imageHeight", label: "Height", type: "number", min: 512, max: 1536, step: 64 },
    { key: "batchSize", label: "Images", type: "number", min: 1, max: 4 },
  ],
};
