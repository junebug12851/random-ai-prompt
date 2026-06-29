/**
 * Picsart — **server-side** upscale adapter (proxy / dev middleware). Multipart POST to
 * `tools/1.0/upscale` with the inlined image as a file + an `upscale_factor`; returns the result's
 * `data.url`, which the proxy fetches back to a data URL. Key used once, never stored.
 * @module gui/providers/picsart/code/upscale-server
 */

/**
 * @param {object} args `{ image (data URI), key, params: { factor? } }`.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On a malformed image, non-OK response, or missing url.
 */
export default async function upscaleServer({ image, key, params = {} }) {
  const m = typeof image === "string" && image.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error("Picsart upscale expects an inlined image.");
  const buf = Buffer.from(m[2], "base64");

  const fd = new FormData();
  fd.append("image", new Blob([buf], { type: m[1] }), "image.png");
  fd.append("upscale_factor", String(params.factor || 2));

  const res = await fetch("https://api.picsart.io/tools/1.0/upscale", {
    method: "POST",
    headers: { "X-Picsart-API-Key": key, accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.detail || `Picsart returned ${res.status}`);
  const url = data?.data?.url || data?.url;
  if (!url) throw new Error("Picsart returned no image url.");
  return { images: [url] };
}
