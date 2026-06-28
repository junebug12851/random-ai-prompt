/**
 * OpenAI Images — client generate adapter. Calls the OpenAI Images API **directly from the
 * browser** with the user's BYOK key (OpenAI sends CORS headers, so no proxy is needed). The
 * shared `server.js` holds the actual fetch; this maps settings → its params.
 * @module gui/providers/openai/code/generate
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
    params: {
      model: settings.model || "gpt-image-1",
      size: settings.size || "1024x1024",
      n: settings.batchSize || 1,
    },
  });
}
