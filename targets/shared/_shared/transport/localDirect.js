/**
 * `local-direct` transport helper — talk to the user's OWN local server (ComfyUI,
 * A1111/Forge/SD.Next, …).
 *
 * In a **browser** the JSON API calls are routed through our backend's `/api/forward` endpoint
 * (server-side fetch) so they work even when the local server sends no CORS headers — which Comfy
 * Desktop and a default A1111 do not. Image URLs are returned direct: an `<img>` tag is not subject
 * to CORS for display, only the fetch() API calls are.
 *
 * A **native** target has no CORS at all, so it calls the local server straight — no backend in the
 * loop (which also means it works with no desktop app running). That's `configureTransport({
 * forward: false })`; see `./config.js`. The default is the browser behavior, so the web is
 * unchanged.
 * @module gui/providers/_shared/transport/localDirect
 */
import { apiUrl, getTransportConfig, transportFetch } from "./config.js";

const FORWARD = "/api/forward";

/**
 * Turn an upstream error payload into a readable message. Local servers like ComfyUI return
 * an `error` **object** plus per-node `node_errors`; without this, `String(error)` becomes the
 * useless "[object Object]". Pull out the human text (and node validation details).
 * @param {object} data The parsed upstream error body.
 * @param {string} url The target URL.
 * @param {number} status The HTTP status.
 * @returns {string} A readable error message.
 */
function readableError(data, url, status) {
  let msg = data?.error;
  if (msg && typeof msg === "object") msg = msg.message || JSON.stringify(msg);
  const nodeErrors = data?.node_errors;
  if (nodeErrors && typeof nodeErrors === "object") {
    const details = Object.values(nodeErrors)
      .flatMap((n) => (n?.errors || []).map((e) => e.details || e.message))
      .filter(Boolean);
    if (details.length) msg = `${msg || "Validation failed"} — ${details.join("; ")}`;
  }
  return msg || `${url} returned ${status}`;
}

/**
 * Call a local server — through the backend's forward proxy in a browser (to dodge CORS), or
 * directly on a native target (no CORS, no backend needed).
 * @param {string} url The absolute local URL (e.g. http://127.0.0.1:8188/prompt).
 * @param {string} method HTTP method.
 * @param {object} [body] JSON body (for POST).
 * @param {AbortSignal} [signal] Optional abort signal.
 * @returns {Promise<object>} The parsed JSON response.
 * @throws {Error} With the upstream error message on a non-OK response.
 */
async function forward(url, method, body, signal) {
  const direct = !getTransportConfig().forward;
  let res;
  try {
    res = direct
      ? await transportFetch(url, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          signal,
          body: body ? JSON.stringify(body) : undefined,
        })
      : await transportFetch(apiUrl(FORWARD), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({ url, method, body }),
        });
  } catch (e) {
    // A native target reaches the server over the LAN, where "unreachable" is the common failure
    // (wrong IP, server not listening on 0.0.0.0, phone on another network). Say so plainly rather
    // than surfacing a bare "Network request failed".
    if (direct) {
      throw new Error(
        `Can't reach ${url} — check the Server URL and that the server is on this Wi-Fi.`,
        { cause: e },
      );
    }
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(data, url, res.status));
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
