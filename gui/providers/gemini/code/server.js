/**
 * Google Gemini — server-side adapter (runs in the proxy). Calls `generateContent` and pulls the
 * inline base64 image from the response parts. Key used once, never stored.
 * @module gui/providers/gemini/code/server
 */

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default async function server({ prompt, key, params = {} }) {
  const model = params.model || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini returned ${res.status}`);

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const images = parts
    .filter((p) => p.inlineData?.data || p.inline_data?.data)
    .map((p) => {
      const d = p.inlineData || p.inline_data;
      return `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`;
    });
  if (!images.length) throw new Error("Gemini returned no image (try the other image model).");
  return { images };
}
