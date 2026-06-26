/**
 * `hosted-proxy` transport — client side. The browser never calls a hosted image API
 * directly (key safety + CORS); instead it POSTs `{ providerId, prompt, key, params }`
 * to our own `/api/generate` endpoint. That endpoint is served by the same shared handler
 * everywhere: a Netlify function when deployed online, and a Vite dev-server middleware
 * when running locally (`npm run web`). The key is sent per-request and never stored.
 * @module gui/providers/_shared/transport/hostedProxy
 */

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
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ providerId, prompt, key, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Proxy returned ${res.status}`);
  return { images: data.images || [] };
}
