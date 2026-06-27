/**
 * Google Gemini — client generate adapter (posts to the shared proxy).
 * @module gui/providers/gemini/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ prompt, settings, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "gemini",
    prompt,
    key,
    signal,
    params: { model: settings.model || "gemini-2.5-flash-image" },
  });
}
