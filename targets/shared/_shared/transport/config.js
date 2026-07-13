/**
 * Transport configuration — the ONE genuinely platform-specific part of the provider layer.
 *
 * Provider `code/` (generate / rewrite / upscale) is shared verbatim across every target. The
 * *transport* underneath it is not, and that difference is what used to force a target to fork the
 * whole provider registry:
 *
 *   - **`hosted-proxy`** posts to our own backend. In a browser that's the same origin, so a
 *     relative `/api/generate` works. A native app has **no origin** — it needs an absolute base
 *     URL (the user's desktop app or self-hosted server).
 *   - **`local-direct`** talks to the user's own server (ComfyUI / A1111 / SD.Next). The browser
 *     can't call it directly — those servers send no CORS headers — so the web tunnels through the
 *     dev server's `/api/forward`. A native app has **no CORS at all** and should call the local
 *     server straight, with no backend in the loop.
 *
 * So instead of forking, each target *configures* the transport once at boot:
 *
 * ```js
 * // web (default — nothing to do): apiBase "" → "/api/generate"; forward: true
 * // mobile:
 * configureTransport({ apiBase: settings.backendUrl, forward: false, timeoutMs: 120_000 });
 * ```
 *
 * Defaults reproduce the web's exact current behavior, so the web is a no-op.
 * @module targets/shared/_shared/transport/config
 */

/**
 * @typedef {object} TransportConfig
 * @property {string} apiBase Base URL prefixed to our own backend routes (`/api/…`). Empty string =
 *   same-origin relative (the browser default). Native targets set an absolute base.
 * @property {boolean} forward Route `local-direct` calls through the backend's `/api/forward` proxy
 *   (needed in a browser to dodge CORS). False = call the local server directly (native).
 * @property {number} timeoutMs Abort a transport fetch after this long. `0` = no timeout (the
 *   browser default — a local SD render can legitimately run for minutes).
 */

/** @type {TransportConfig} */
const DEFAULTS = { apiBase: "", forward: true, timeoutMs: 0 };

let config = { ...DEFAULTS };

/**
 * Configure the transport for this target. Call once at boot (and again whenever a user-editable
 * value like the Backend URL changes). Partial: unspecified keys keep their current value.
 * @param {Partial<TransportConfig>} next The values to change.
 * @returns {TransportConfig} The resulting config.
 */
export function configureTransport(next = {}) {
  config = { ...config, ...next };
  return config;
}

/**
 * The current transport config.
 * @returns {TransportConfig} The config.
 */
export function getTransportConfig() {
  return config;
}

/** Reset to the built-in (browser) defaults — used by tests. */
export function resetTransportConfig() {
  config = { ...DEFAULTS };
}

/**
 * Resolve one of our own backend routes against the configured base.
 * @param {string} route The route, e.g. `/api/generate`.
 * @returns {string} An absolute URL on a native target, or the relative route in a browser.
 * @throws {Error} When a native target hasn't been given a backend URL yet.
 */
export function apiUrl(route) {
  const base = (config.apiBase || "").replace(/\/+$/, "");
  return base ? `${base}${route}` : route;
}

/**
 * `fetch` with the configured timeout applied (and any caller signal honored). React Native's fetch
 * has no built-in timeout, so a hung server or dead Wi-Fi would otherwise block a generation
 * forever. With `timeoutMs: 0` (the browser default) this is a plain `fetch`.
 * @param {string} url The URL.
 * @param {object} [options] Fetch options (`signal` is merged with the timeout's).
 * @returns {Promise<Response>} The response.
 */
export function transportFetch(url, options = {}) {
  const { timeoutMs = config.timeoutMs, signal: external, ...rest } = options;
  if (!timeoutMs) return fetch(url, { ...rest, signal: external });

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener?.("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    external?.removeEventListener?.("abort", onAbort);
  });
}
