/**
 * Black Forest Labs (FLUX) — provider-owned settings. `model` is the BFL endpoint name.
 * @module gui/providers/bfl/settings
 */
import defaults from "./bfl.json";

export default {
  defaults,
  fields: [
    {
      key: "model",
      label: "Model",
      type: "select",
      options: ["flux-pro-1.1", "flux-pro-1.1-ultra", "flux-pro", "flux-dev"],
    },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
    },
  ],
};
