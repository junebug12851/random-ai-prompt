/**
 * Replicate — **server-side** AI-upscale adapter (runs in the proxy / dev middleware, never the
 * browser). Runs Real-ESRGAN via the model endpoint with `Prefer: wait` (synchronous, no manual
 * polling), mirroring the generate server adapter. The `image` is a `data:` URI the proxy inlined
 * from the local output folder (Replicate accepts data URIs for file inputs). Key used once.
 * @module gui/providers/replicate/code/upscale-server
 */

/**
 * @param {object} args
 * @param {string} args.image A `data:` URI of the source image.
 * @param {string} args.key The user's Replicate API token.
 * @param {object} [args.params] `{ model?, scale? }`.
 * @returns {Promise<{images: string[]}>} Upscaled image URL(s) (replicate.delivery).
 * @throws {Error} On a non-OK response or an unexpected output shape.
 */
export default async function upscaleServer({ image, key, params = {} }) {
  const model = params.model || "nightmareai/real-esrgan";
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input: { image, scale: params.scale || 4 } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.title || `Replicate returned ${res.status}`);

  let out = data.output;
  if (typeof out === "string") out = [out];
  const images = (out || []).filter((u) => typeof u === "string");
  if (!images.length) {
    throw new Error("Replicate returned no upscaled image (this model may use a different output shape).");
  }
  return { images };
}
