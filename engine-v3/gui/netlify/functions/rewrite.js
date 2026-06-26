/**
 * The prompt-rewrite (auto-fix) proxy (Netlify function) — ONLINE entry point. Receives
 * `{ providerId, prompt, key }`, dispatches to the chosen text provider's rewrite adapter, and
 * returns `{ text }`. Stores nothing, never logs the key. The local equivalent is the Vite
 * middleware (`gui/vite-plugin-api.js`), sharing the same `server/dispatch.js`.
 * @module gui/netlify/rewrite
 */
import { dispatchRewrite } from "../../server/dispatch.js";

/**
 * @param {object} event The Netlify function event.
 * @returns {Promise<object>} A `{statusCode, headers, body}` response.
 */
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { providerId, prompt, key } = body;
  if (!prompt) return json(400, { error: "Missing prompt" });

  try {
    const out = await dispatchRewrite({ providerId, prompt, key });
    return json(200, out);
  } catch (e) {
    return json(502, { error: e.message || "Rewrite failed" });
  }
};

/**
 * @param {number} statusCode HTTP status.
 * @param {object} obj Body.
 * @returns {object} A Netlify response.
 */
function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
