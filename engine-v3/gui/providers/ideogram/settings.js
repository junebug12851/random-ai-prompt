/**
 * Ideogram — provider-owned settings (v2 aspect-ratio enum format).
 * @module gui/providers/ideogram/settings
 */
export default {
  defaults: { model: "V_2", aspectRatio: "ASPECT_1_1" },
  fields: [
    { key: "model", label: "Model", type: "select", options: ["V_2", "V_2_TURBO", "V_3"] },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: [
        "ASPECT_1_1",
        "ASPECT_16_9",
        "ASPECT_9_16",
        "ASPECT_4_3",
        "ASPECT_3_4",
        "ASPECT_3_2",
        "ASPECT_2_3",
      ],
    },
  ],
};
