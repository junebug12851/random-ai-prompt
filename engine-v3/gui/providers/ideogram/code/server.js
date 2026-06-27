/**
 * Ideogram — server-side adapter (runs in the proxy). v2 JSON `/generate` endpoint; auth header
 * `Api-Key`. Returns image URLs. Key used once, never stored.
 * @module gui/providers/ideogram/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const res = await fetch("https://api.ideogram.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({
      image_request: {
        prompt,
        model: params.model || "V_2",
        aspect_ratio: params.aspect_ratio || "ASPECT_1_1",
        magic_prompt_option: "AUTO",
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Ideogram returned ${res.status}`);
  const images = (data.data || []).map((d) => d.url).filter(Boolean);
  if (!images.length) throw new Error("Ideogram returned no image.");
  return { images };
}
