/**
 * Replicate — server-side adapter (runs in the proxy). Creates a prediction on the chosen
 * model endpoint with `Prefer: wait` so the call blocks until the image is ready, then returns
 * the output URL(s). Key is used once, never stored.
 * @module gui/providers/replicate/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const model = params.model || "black-forest-labs/flux-schnell";
  const input = { prompt, num_outputs: params.n || 1 };
  if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.title || `Replicate returned ${res.status}`);

  let out = data.output;
  if (typeof out === "string") out = [out];
  const images = (out || []).filter((u) => typeof u === "string");
  if (!images.length) {
    throw new Error(
      "Replicate returned no image URL (this model may use a different output shape).",
    );
  }
  return { images };
}
