/**
 * Deep-Image.ai — **server-side** upscale adapter. POSTs `rest_api/process_result` (`x-api-key`) with
 * the image as a data-URI `url` and a 4× target size (decoded from the source bytes). Returns a
 * `result_url` directly when fast (<25s), else a `job` hash we poll via `rest_api/result/{job}`.
 * Best-effort — Deep-Image's `url` usually wants a public URL, so a data URI may need adjusting.
 * @module gui/providers/deepimage/code/upscale-server
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Best-effort intrinsic size from PNG/JPEG bytes; null if undecodable. */
function imageSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off += 1;
        continue;
      }
      const mk = buf[off + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      if (mk === 0xd8 || mk === 0xd9 || (mk >= 0xd0 && mk <= 0xd7)) {
        off += 2;
        continue;
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}

/** @param {object} args `{ image (data URI), key, params: { factor? } }`. @returns {Promise<{images: string[]}>} */
export default async function upscaleServer({ image, key, params = {} }) {
  const m = typeof image === "string" && image.match(/^data:[^;]+;base64,(.*)$/s);
  if (!m) throw new Error("Deep-Image upscale expects an inlined image.");
  const size = imageSize(Buffer.from(m[1], "base64"));
  const factor = params.factor || 4;
  const body = { url: image };
  if (size) {
    body.width = Math.min(4096, size.w * factor);
    body.height = Math.min(4096, size.h * factor);
  }

  const res = await fetch("https://deep-image.ai/rest_api/process_result", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || d?.message || `Deep-Image returned ${res.status}`);
  if (d?.result_url) return { images: [d.result_url] };

  const job = d?.job || d?.hash;
  if (!job) throw new Error("Deep-Image returned neither a result nor a job.");
  const deadline = Date.now() + 180000;
  for (;;) {
    await sleep(2500);
    const pr = await fetch(`https://deep-image.ai/rest_api/result/${job}`, {
      method: "POST",
      headers: { "x-api-key": key },
    });
    const pd = await pr.json().catch(() => ({}));
    if (pd?.result_url) return { images: [pd.result_url] };
    if (pd?.status === "failed" || pd?.status === "error")
      throw new Error("Deep-Image job failed.");
    if (Date.now() > deadline) throw new Error("Deep-Image job timed out.");
  }
}
