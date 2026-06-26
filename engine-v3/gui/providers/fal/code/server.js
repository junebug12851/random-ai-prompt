/**
 * fal.ai — server-side adapter (runs in the proxy). Calls the synchronous `fal.run/<model>`
 * endpoint and returns the image URLs. Auth header is `Key <token>`. Key used once, never stored.
 * @module gui/providers/fal/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const model = params.model || "fal-ai/flux/schnell";
  const body = { prompt, num_images: params.n || 1 };
  if (params.image_size) body.image_size = params.image_size;

  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.message || `fal returned ${res.status}`);

  const images = (data.images || [])
    .map((i) => (typeof i === "string" ? i : i?.url))
    .filter(Boolean);
  if (!images.length) throw new Error("fal returned no image (unexpected response shape).");
  return { images };
}
