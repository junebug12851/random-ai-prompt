/**
 * Venice AI — **server-side** upscale adapter (proxy / dev middleware). JSON POST to
 * `v1/image/upscale` with the base64 `image` + a `scale` (1–4), Bearer auth. Venice returns the
 * image bytes (or, occasionally, JSON with a base64/url) — both are normalized to a data URL. Key
 * used once, never stored.
 * @module gui/providers/venice/code/upscale-server
 */

/**
 * @param {object} args `{ image (data URI), key, params: { scale? } }`.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On a malformed image or non-OK response.
 */
export default async function upscaleServer({ image, key, params = {} }) {
  const m = typeof image === "string" && image.match(/^data:[^;]+;base64,(.*)$/s);
  if (!m) throw new Error("Venice upscale expects an inlined image.");

  const res = await fetch("https://api.venice.ai/api/v1/image/upscale", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image: m[1], scale: Math.min(4, Math.max(1, params.scale || 4)) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Venice returned ${res.status}`);
  }
  const ct = (res.headers.get("content-type") || "image/png").split(";")[0];
  if (ct.includes("application/json")) {
    const d = await res.json().catch(() => ({}));
    const out = d?.images?.[0] || d?.image || d?.url;
    if (!out) throw new Error("Venice returned no image.");
    return { images: [String(out).startsWith("http") ? out : `data:image/png;base64,${out}`] };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { images: [`data:${ct};base64,${buf.toString("base64")}`] };
}
