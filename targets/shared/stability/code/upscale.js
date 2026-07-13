/**
 * Stability AI — client AI-upscale adapter. Uses the v2beta **fast** upscaler
 * (`stable-image/upscale/fast`), a synchronous ~4× super-resolution that returns the image inline
 * (base64), mirroring the generate adapter's auth + multipart shape. Browser-direct with the user's
 * BYOK key (CORS-enabled). The image is read from its served URL and re-posted as multipart.
 * (The creative/conservative upscalers are async — return an id you then poll `/v2beta/results/{id}`;
 * `fast` is the simplest and is plenty for re-sizing a saved render.)
 * @module gui/providers/stability/code/upscale
 */

/**
 * @param {object} args
 * @param {string} args.image The source image URL (a served `/api/output/...` path, absolute).
 * @param {string} args.key The user's Stability API key.
 * @returns {Promise<{images: string[]}>} The upscaled image as a base64 `data:` URL.
 * @throws {Error} When the source can't be read or Stability returns a non-OK response.
 */
export default async function upscale({ image, key }) {
  const srcRes = await fetch(image);
  if (!srcRes.ok) throw new Error(`Couldn't read the source image (${srcRes.status}).`);
  const blob = await srcRes.blob();

  const fd = new FormData();
  fd.append("image", blob);
  fd.append("output_format", "png");

  const res = await fetch("https://api.stability.ai/v2beta/stable-image/upscale/fast", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data?.errors && data.errors[0]) || data?.message || data?.name;
    throw new Error(msg || `Stability upscale returned ${res.status}`);
  }
  const images = data.image ? [`data:image/png;base64,${data.image}`] : [];
  if (!images.length) throw new Error("Stability returned no upscaled image.");
  return { images };
}
