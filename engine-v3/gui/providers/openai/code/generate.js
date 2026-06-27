/**
 * OpenAI Images — client generate adapter. Maps settings to the proxy params and calls the
 * shared `/api/generate` proxy (the key + upstream call stay server-side; see `server.js`).
 * @module gui/providers/openai/code/generate
 */
import { callProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args
 * @param {string} args.prompt The expanded prompt.
 * @param {object} args.settings The merged settings.
 * @param {string} args.key The BYOK API key (per-request).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key, signal }) {
  return callProxy({
    providerId: "openai",
    prompt,
    key,
    signal,
    params: {
      model: settings.model || "gpt-image-1",
      size: settings.size || "1024x1024",
      n: settings.batchSize || 1,
    },
  });
}
