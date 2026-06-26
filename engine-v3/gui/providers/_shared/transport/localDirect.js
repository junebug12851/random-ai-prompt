/**
 * `local-direct` transport helper — talk to the user's OWN local server (ComfyUI,
 * A1111/Forge/SD.Next, …). The JSON API calls are routed through our dev server's
 * `/api/forward` endpoint (server-side fetch) so they work even when the local server sends
 * no CORS headers — which Comfy Desktop and a default A1111 do not. Image URLs are returned
 * direct: an `<img>` tag is not subject to CORS for display, only the fetch() API calls are.
 * Local providers only run with the dev server present (they're hidden in online mode).
 * @module gui/providers/_shared/transport/localDirect
 */

const FORWARD = "/api/forward";

/**
 * Forward a request to a local server through the dev proxy (avoids CORS).
 * @param {string} url The absolute local URL (e.g. http://127.0.0.1:8188/prompt).
 * @param {string} method HTTP method.
 * @param {object} [body] JSON body (for POST).
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 * @throws {Error} With the upstream error message on a non-OK response.
 */
async function forward(url, method, body, signal) {
  const res = await fetch(FORWARD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ url, method, body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `${url} returned ${res.status}`);
  return data;
}

/**
 * POST JSON to a local endpoint (via the proxy) and parse the JSON response.
 * @param {string} url The absolute endpoint URL.
 * @param {object} body The request body.
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 */
export function postJson(url, body, signal) {
  return forward(url, "POST", body, signal);
}

/**
 * GET a local endpoint (via the proxy) and parse the JSON response.
 * @param {string} url The absolute endpoint URL.
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 */
export function getJson(url, signal) {
  return forward(url, "GET", undefined, signal);
}

/**
 * Normalize a base URL: trim trailing slashes so `${base}/path` is always well-formed.
 * @param {string} url The raw base URL.
 * @param {string} fallback The default to use when `url` is empty.
 * @returns {string} The normalized base URL.
 */
export function normalizeBase(url, fallback) {
  return (url || fallback).replace(/\/+$/, "");
}
