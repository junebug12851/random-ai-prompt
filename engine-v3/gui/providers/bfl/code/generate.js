/**
 * Black Forest Labs (FLUX) — client generate adapter (posts to the shared proxy).
 * @module gui/providers/bfl/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "bfl",
    prompt,
    key,
    signal,
    params: { model: settings.model || "flux-dev", aspect_ratio: settings.aspectRatio || "1:1" },
  });
}
