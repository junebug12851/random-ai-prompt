/**
 * Ideogram — client generate adapter (posts to the shared proxy).
 * @module gui/providers/ideogram/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "ideogram",
    prompt,
    key,
    signal,
    params: { model: settings.model || "V_2", aspect_ratio: settings.aspectRatio || "ASPECT_1_1" },
  });
}
