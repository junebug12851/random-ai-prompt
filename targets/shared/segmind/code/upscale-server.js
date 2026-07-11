/**
 * Segmind — **server-side** ESRGAN upscale adapter (proxy / dev middleware). JSON POST to
 * `v1/esrgan` with the base64 image + a `scale`; Segmind returns the image **bytes** on success
 * (JSON on error), so we read the body and return a data URL. Key used once, never stored.
 * @module gui/providers/segmind/code/upscale-server
 */

/**
 * @param {object} args `{ image (data URI), key, params: { scale? } }`.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On a malformed image or non-OK response.
 */
export default async function upscaleServer({ image, key, params = {} }) {
  const m = typeof image === "string" && image.match(/^data:[^;]+;base64,(.*)$/s);
  if (!m) throw new Error("Segmind upscale expects an inlined image.");

  const res = await fetch("https://api.segmind.com/v1/esrgan", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ image: m[1], scale: params.scale || 4, output_format: "png" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Segmind returned ${res.status}`);
  }
  const ct = (res.headers.get("content-type") || "image/png").split(";")[0];
  const buf = Buffer.from(await res.arrayBuffer());
  return { images: [`data:${ct};base64,${buf.toString("base64")}`] };
}
