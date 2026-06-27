/**
 * Grok (xAI) — server-side adapter (runs in the proxy). The xAI images endpoint is
 * OpenAI-compatible. Key used once, never stored.
 * @module gui/providers/grok/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: params.model || "grok-2-image", prompt, n: params.n || 1 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || `xAI returned ${res.status}`);
  }
  const images = (data.data || [])
    .map((d) => (d.b64_json ? `data:image/jpeg;base64,${d.b64_json}` : d.url))
    .filter(Boolean);
  if (!images.length) throw new Error("Grok returned no image.");
  return { images };
}
