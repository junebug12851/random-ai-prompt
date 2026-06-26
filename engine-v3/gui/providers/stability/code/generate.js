/**
 * Stability AI — client generate adapter (posts to the shared proxy).
 * @module gui/providers/stability/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "stability",
    prompt,
    key,
    signal,
    params: {
      model: settings.model || "core",
      aspect_ratio: settings.aspectRatio || "1:1",
      negativePrompt: settings.negativePrompt || "",
    },
  });
}
