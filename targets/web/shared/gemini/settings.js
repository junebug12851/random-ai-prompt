/**
 * Google Gemini — provider-owned settings. `model` is a Gemini image model id.
 * @module gui/providers/gemini/settings
 */
import defaults from "./gemini.json";

export default {
  defaults,
  fields: [
    {
      key: "model",
      label: "Model",
      type: "select",
      options: ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"],
    },
  ],
};
