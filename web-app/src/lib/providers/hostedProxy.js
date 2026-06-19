/**
 * Hosted (BYOK) provider — posts the prompt + the user's key to the stateless Netlify
 * proxy, which forwards to a hosted image API. The key is per-request, never stored.
 * @module web-app/lib/providers/hostedProxy
 */
// Hosted provider via the stateless Netlify proxy (bring your own key).
//
// The proxy forwards the user's key to the chosen hosted image API, polls for the
// result (submit -> poll so each function call stays short), and returns image
// URLs. The key is sent per-request and is never stored or logged server-side.
export const hostedProxyProvider = {
  id: "hosted-proxy",
  label: "Hosted API (bring your own key)",
  local: false,
  needsKey: true,

  async generate({ prompt, settings, key, signal }) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        prompt,
        key,
        params: {
          steps: settings.imageSteps,
          width: settings.imageWidth,
          height: settings.imageHeight,
          cfg: settings.cfg,
          sampler: settings.sampler,
          negativePrompt: settings.negativePrompt || "",
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Proxy returned ${res.status}`);
    return { images: data.images || [] };
  },
};
