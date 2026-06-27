/**
 * Stability AI — server-side adapter (runs in the proxy). Multipart POST to the v2beta
 * stable-image endpoint, `Accept: application/json` → base64 image. Key used once, never stored.
 * @module gui/providers/stability/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const endpoint = params.model || "core"; // core | sd3 | ultra
  const fd = new FormData();
  fd.append("prompt", prompt);
  fd.append("output_format", "png");
  if (params.aspect_ratio) fd.append("aspect_ratio", params.aspect_ratio);
  if (params.negativePrompt) fd.append("negative_prompt", params.negativePrompt);

  const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data?.errors && data.errors[0]) || data?.message || data?.name;
    throw new Error(msg || `Stability returned ${res.status}`);
  }
  const images = data.image ? [`data:image/png;base64,${data.image}`] : [];
  if (!images.length) throw new Error("Stability returned no image.");
  return { images };
}
