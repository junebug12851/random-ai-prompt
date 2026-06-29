/**
 * DeepAI — **server-side** super-resolution adapter (runs in the proxy / dev middleware). DeepAI is
 * a single multipart POST authenticated with an `api-key` header; the input image (handed over as a
 * `data:` URI the proxy inlined) is uploaded as a file. Returns the result's `output_url`. Key used
 * once, never stored.
 * @module gui/providers/deepai/code/upscale-server
 */

/**
 * @param {object} args
 * @param {string} args.image A `data:` URI of the source image.
 * @param {string} args.key The user's DeepAI API key.
 * @returns {Promise<{images: string[]}>} The upscaled image URL.
 * @throws {Error} On a malformed image, a non-OK response, or a missing output.
 */
export default async function upscaleServer({ image, key }) {
  const m = typeof image === "string" && image.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error("DeepAI upscale expects an inlined image.");
  const buf = Buffer.from(m[2], "base64");

  const fd = new FormData();
  fd.append("image", new Blob([buf], { type: m[1] }), "image.png");

  const res = await fetch("https://api.deepai.org/api/torch-srgan", {
    method: "POST",
    headers: { "api-key": key },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.err || data?.status || `DeepAI returned ${res.status}`);
  const url = data?.output_url;
  if (!url) throw new Error("DeepAI returned no output_url.");
  return { images: [url] };
}
