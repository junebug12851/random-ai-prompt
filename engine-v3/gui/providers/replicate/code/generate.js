/**
 * Replicate — client generate adapter (posts to the shared proxy; the key + upstream call run
 * server-side in `server.js`).
 * @module gui/providers/replicate/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "replicate",
    prompt,
    key,
    signal,
    params: {
      model: settings.model || "black-forest-labs/flux-schnell",
      aspect_ratio: settings.aspectRatio || "1:1",
      n: settings.batchSize || 1,
    },
  });
}
