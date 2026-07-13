/**
 * Claid.ai / Let's Enhance — **server-side** upscale adapter. Synchronous: multipart upload to
 * `v1/image/edit/upload` (the `file` part + a `data` JSON part with the operations), Bearer auth;
 * the response carries the output image's temporary URL. Best-effort — verify against current docs.
 * @module gui/providers/claid/code/upscale-server
 */

/** @param {object} args `{ image (data URI), key }`. @returns {Promise<{images: string[]}>} */
export default async function upscaleServer({ image, key }) {
  const m = typeof image === "string" && image.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error("Claid upscale expects an inlined image.");
  const buf = Buffer.from(m[2], "base64");

  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: m[1] }), "image.png");
  fd.append("data", JSON.stringify({ operations: { restorations: { upscale: "smart_enhance" } } }));

  const res = await fetch("https://api.claid.ai/v1/image/edit/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error_message || d?.message || `Claid returned ${res.status}`);
  const url = d?.data?.output?.tmp_url || d?.data?.output?.url || d?.output?.tmp_url;
  if (!url) throw new Error("Claid returned no output url.");
  return { images: [url] };
}
