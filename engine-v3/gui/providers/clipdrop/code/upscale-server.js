/**
 * Clipdrop — **server-side** upscale adapter (proxy / dev middleware). Clipdrop's sync upscaler wants
 * explicit `target_width`/`target_height` (not a factor), so we decode the source dimensions from the
 * image bytes (PNG / JPEG) and request a 4× target capped at 4096. Multipart `image_file` +
 * `x-api-key`; returns the upscaled image bytes → a data URL. Key used once, never stored.
 * @module gui/providers/clipdrop/code/upscale-server
 */

/** Best-effort intrinsic size from raw image bytes (PNG + JPEG); null if undecodable. */
function imageSize(buf) {
  // PNG: 8-byte signature, then IHDR — width @16, height @20 (big-endian uint32).
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: scan for a Start-Of-Frame marker (SOF0–SOFn, excluding non-SOF FF markers).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off += 1;
        continue;
      }
      const marker = buf[off + 1];
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
  }
  return null;
}

/**
 * @param {object} args `{ image (data URI), key, params: { factor? } }`.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On a malformed image or non-OK response.
 */
export default async function upscaleServer({ image, key, params = {} }) {
  const m = typeof image === "string" && image.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error("Clipdrop upscale expects an inlined image.");
  const buf = Buffer.from(m[2], "base64");

  const factor = params.factor || 4;
  const cap = 4096;
  const size = imageSize(buf);
  const tw = size ? Math.min(cap, size.w * factor) : 2048;
  const th = size ? Math.min(cap, size.h * factor) : 2048;

  const fd = new FormData();
  fd.append("image_file", new Blob([buf], { type: m[1] }), "image.png");
  fd.append("target_width", String(tw));
  fd.append("target_height", String(th));

  const res = await fetch("https://clipdrop-api.co/image-upscaling/v1/upscale", {
    method: "POST",
    headers: { "x-api-key": key },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Clipdrop returned ${res.status}`);
  }
  const ct = (res.headers.get("content-type") || "image/webp").split(";")[0];
  const out = Buffer.from(await res.arrayBuffer());
  return { images: [`data:${ct};base64,${out.toString("base64")}`] };
}
