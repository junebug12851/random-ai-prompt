/**
 * Grok (xAI) — client generate adapter (posts to the shared proxy).
 * @module gui/providers/grok/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "grok",
    prompt,
    key,
    signal,
    params: { model: settings.model || "grok-2-image", n: settings.batchSize || 1 },
  });
}
