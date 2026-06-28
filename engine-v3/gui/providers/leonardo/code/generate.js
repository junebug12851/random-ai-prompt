/**
 * Leonardo AI — client generate adapter. Calls the Leonardo API directly from the browser
 * (CORS-enabled) with the user's BYOK key; `server.js` holds the submit-then-poll fetch.
 * @module gui/providers/leonardo/code/generate
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
      model: settings.model,
      width: settings.imageWidth || 1024,
      height: settings.imageHeight || 1024,
      n: settings.batchSize || 1,
    },
  });
}
