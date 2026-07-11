/**
 * `hosted-proxy` transport — client side. The browser never calls a hosted image API
 * directly (key safety + CORS); instead it POSTs `{ providerId, prompt, key, params }`
 * to our own `/api/generate` endpoint. That endpoint is served by the same shared handler
 * everywhere: a Netlify function when deployed online, and a Vite dev-server middleware
 * when running locally (`npm run web`). The key is sent per-request and never stored.
 *
 * The route is resolved through {@link apiUrl}, so a **native** target (which has no origin, and
 * therefore no same-origin `/api/…`) points these calls at an absolute Backend URL by calling
 * `configureTransport({ apiBase })` at boot. In a browser `apiBase` is empty and the URL stays the
 * relative `/api/generate` it has always been. See `./config.js`.
 * @module gui/providers/_shared/transport/hostedProxy
 */
import { apiUrl, transportFetch } from "./config.js";

/**
 * Call the generation proxy for a hosted provider.
 * @param {object} args
 * @param {string} args.providerId The provider id (routes to its server adapter).
 * @param {string} args.prompt The fully expanded prompt.
 * @param {string} args.key The user's BYOK API key (per-request, never stored).
 * @param {object} args.params Provider params (size/model/steps/… per its capabilities).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>} Image URLs (data:/https:) the browser can display.
 * @throws {Error} On a non-OK proxy response.
 */
export async function callProxy({ providerId, prompt, key, params, signal }) {
  const res = await transportFetch(apiUrl("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ providerId, prompt, key, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Proxy returned ${res.status}`);
  return { images: data.images || [] };
}

/**
 * Call the AI-upscale proxy for a hosted provider whose API the browser can't reach (CORS). The
 * server (`/api/upscale`) inlines the source image (read from the local output folder), runs the
 * provider's upscale-server adapter, and returns the result(s) as `data:` URLs the browser can save.
 * @param {object} args
 * @param {string} args.providerId The provider id (routes to its upscale-server adapter).
 * @param {string} args.image The served `/api/output/...` path (or a `data:` URL) to upscale.
 * @param {string} args.key The user's BYOK API key (per-request, never stored).
 * @param {object} [args.params] Upscale params (e.g. `{ scale }`).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>} Upscaled image(s) as `data:` URLs.
 * @throws {Error} On a non-OK proxy response.
 */
export async function callUpscaleProxy({ providerId, image, key, params, signal }) {
  const res = await transportFetch(apiUrl("/api/upscale"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ providerId, image, key, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upscale proxy returned ${res.status}`);
  return { images: data.images || [] };
}

/**
 * Call the prompt-rewrite proxy for a text provider that isn't `browser-direct` (its API can't be
 * reached from a client, so a server adapter runs it — see the backend's dispatch.js). A
 * browser-direct provider skips this and calls its own API with `loadRewrite()`.
 * @param {object} args
 * @param {string} args.providerId The provider id (routes to its rewrite-server adapter).
 * @param {string} args.prompt The prompt to rewrite.
 * @param {string} args.key The user's BYOK API key (per-request, never stored).
 * @param {string} [args.mode] Rewrite mode (`fix` | `keyword` | `expand` | a `dpl-*` task).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{text: string}>} The rewritten text.
 * @throws {Error} On a non-OK proxy response.
 */
export async function callRewriteProxy({ providerId, prompt, key, mode, signal }) {
  const res = await transportFetch(apiUrl("/api/rewrite"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ providerId, prompt, key, mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Rewrite proxy returned ${res.status}`);
  return { text: data.text || "" };
}
