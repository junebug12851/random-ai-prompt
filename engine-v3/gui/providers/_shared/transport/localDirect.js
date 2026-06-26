/**
 * `local-direct` transport helper — the browser calls the user's OWN local server
 * (ComfyUI, A1111/Forge/SD.Next, …) directly over CORS on localhost. No key, no proxy.
 * @module gui/providers/_shared/transport/localDirect
 */

/**
 * POST JSON to a local endpoint and parse the JSON response.
 * @param {string} url The absolute endpoint URL.
 * @param {object} body The request body (JSON-serialized).
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 * @throws {Error} If the response is not OK.
 */
export async function postJson(url, body, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

/**
 * GET a URL and parse the JSON response.
 * @param {string} url The absolute endpoint URL.
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 * @throws {Error} If the response is not OK.
 */
export async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
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
