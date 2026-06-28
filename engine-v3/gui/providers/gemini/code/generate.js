/**
 * Google Gemini — client generate adapter. Calls the Gemini API directly from the browser
 * (CORS-enabled) with the user's BYOK key; `server.js` holds the actual fetch.
 * @module gui/providers/gemini/code/generate
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
    params: { model: settings.model || "gemini-2.5-flash-image" },
  });
}
