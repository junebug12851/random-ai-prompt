/**
 * The stateless BYOK generation proxy (Netlify function) — the ONLINE entry point. Receives
 * `{ providerId, prompt, key, params }`, dispatches to the chosen hosted provider's server
 * adapter, and returns `{ images }`. Stores nothing, never logs the key. The local dev
 * equivalent is the Vite middleware in `gui/vite-plugin-api.js`, which shares the same
 * `server/dispatch.js`.
 * @module gui/netlify/generate
 */
import { dispatch } from "../../server/dispatch.js";

/**
 * Netlify function entry: validate, then dispatch to the hosted provider.
 * @param {object} event The Netlify function event (`httpMethod`, `body`).
 * @returns {Promise<object>} A `{statusCode, headers, body}` response.
 */
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { providerId, prompt, key, params } = body;
  if (!prompt) return json(400, { error: "Missing prompt" });
  if (!key) return json(400, { error: "Missing API key" });

  try {
    const out = await dispatch({ providerId, prompt, key, params });
    return json(200, out);
  } catch (e) {
    return json(502, { error: e.message || "Generation failed" });
  }
};

/**
 * Build a JSON HTTP response.
 * @param {number} statusCode The HTTP status.
 * @param {object} obj The response body object.
 * @returns {object} A Netlify `{statusCode, headers, body}` response.
 */
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
