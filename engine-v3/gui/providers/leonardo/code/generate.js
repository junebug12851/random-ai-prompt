/**
 * Leonardo AI — client generate adapter (posts to the shared proxy).
 * @module gui/providers/leonardo/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "leonardo",
    prompt,
    key,
    signal,
    params: {
      model: settings.model,
      width: settings.imageWidth || 1024,
      height: settings.imageHeight || 1024,
      n: settings.batchSize || 1,
    },
  });
}
