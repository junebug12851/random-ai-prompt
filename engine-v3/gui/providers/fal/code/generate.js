/**
 * fal.ai — client generate adapter. Calls the fal.run API directly from the browser
 * (CORS-enabled) with the user's BYOK key; `server.js` holds the actual fetch.
 * @module gui/providers/fal/code/generate
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
      model: settings.model || "fal-ai/flux/schnell",
      image_size: settings.imageSize || "square_hd",
      n: settings.batchSize || 1,
    },
  });
}
