/**
 * fal.ai — client generate adapter (posts to the shared proxy).
 * @module gui/providers/fal/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "fal",
    prompt,
    key,
    signal,
    params: {
      model: settings.model || "fal-ai/flux/schnell",
      image_size: settings.imageSize || "square_hd",
      n: settings.batchSize || 1,
    },
  });
}
