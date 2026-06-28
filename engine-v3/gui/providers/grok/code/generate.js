/**
 * Grok (xAI) — client generate adapter. Calls the xAI images API directly from the browser
 * (CORS-enabled) with the user's BYOK key; `server.js` holds the actual fetch.
 * @module gui/providers/grok/code/generate
 */
import server from "./server.js";

/**
 * @param {object} args `{ prompt, settings, key }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function generate({ prompt, settings, key }) {
  return server({
    prompt,
    key,
    params: { model: settings.model || "grok-2-image", n: settings.batchSize || 1 },
  });
}
