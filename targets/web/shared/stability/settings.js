/**
 * Stability AI — provider-owned settings. `model` selects the endpoint tier (core/sd3/ultra).
 * Negative prompt accepts DPL (rolled out before sending).
 * @module gui/providers/stability/settings
 */
import defaults from "./stability.json";

export default {
  defaults,
  fields: [
    { key: "model", label: "Model", type: "select", options: ["core", "sd3", "ultra"] },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "9:21"],
    },
    { key: "negativePrompt", label: "Negative prompt", type: "textarea" },
  ],
};
