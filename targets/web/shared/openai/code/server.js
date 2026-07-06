/**
 * OpenAI Images — **server-side** adapter. Runs inside the generation proxy (Netlify
 * function online / Vite dev-middleware locally), never in the browser. Receives the
 * per-request key + params, calls the OpenAI Images API, and returns image URLs. The key
 * is used once and never stored or logged.
 * @module gui/providers/openai/code/server
 */

/**
 * @param {object} args
 * @param {string} args.prompt The expanded prompt.
 * @param {string} args.key The user's OpenAI API key.
 * @param {object} args.params `{ model, size, n }`.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} On a non-OK OpenAI response.
 */
export default async function server({ prompt, key, params = {} }) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: params.model || "gpt-image-1",
      prompt,
      size: params.size || "1024x1024",
      n: params.n || 1,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI returned ${res.status}`);
  }
  const images = (data.data || [])
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter(Boolean);
  return { images };
}
