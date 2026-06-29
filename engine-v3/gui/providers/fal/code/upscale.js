/**
 * fal.ai — client AI-upscale adapter. Runs `fal-ai/esrgan` (Real-ESRGAN) via the synchronous
 * `fal.run` endpoint, browser-direct with the user's BYOK key (`Authorization: Key <token>`).
 *
 * Two encodings matter: the **input** image is sent as a `data:` URI (the source is usually a
 * localhost `/api/output/...` path fal's servers can't reach, so we inline it), and the **output**
 * — a fal CDN URL — is fetched back and returned as a `data:` URL so the central output folder can
 * save the upscaled image locally (the ingest endpoint only persists data/localhost sources).
 * @module gui/providers/fal/code/upscale
 */

/** Fetch an image URL and return it as a base64 `data:` URL (so it can be saved/sent inline). */
async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't read image (${res.status}).`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Couldn't encode the image."));
    fr.readAsDataURL(blob);
  });
}

/**
 * @param {object} args
 * @param {string} args.image The source image URL (served `/api/output/...` path or a `data:` URL).
 * @param {string} args.key The user's fal API key.
 * @returns {Promise<{images: string[]}>} The upscaled image as a base64 `data:` URL.
 * @throws {Error} When the source can't be read or fal returns a non-OK response.
 */
export default async function upscale({ image, key }) {
  const imageUrl = typeof image === "string" && image.startsWith("data:") ? image : await toDataUrl(image);

  const res = await fetch("https://fal.run/fal-ai/esrgan", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      scale: 4,
      model: "RealESRGAN_x4plus",
      output_format: "png",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.message || `fal upscale returned ${res.status}`);

  const out =
    data?.image?.url || (Array.isArray(data?.images) ? data.images[0]?.url || data.images[0] : null);
  if (!out) throw new Error("fal returned no upscaled image.");
  // Bring the fal CDN result back as a data URL so it persists in the local output folder.
  return { images: [await toDataUrl(out)] };
}
