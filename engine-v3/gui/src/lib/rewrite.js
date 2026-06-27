/**
 * Client helper for the auto-fix prompt rewrite. Posts to the shared `/api/rewrite` proxy (Vite
 * middleware locally / Netlify function online) and returns the rewritten prompt text.
 * @module gui/lib/rewrite
 */

/**
 * @param {object} args
 * @param {string} args.providerId The rewrite (text) provider id.
 * @param {string} args.prompt The prompt to clean up.
 * @param {string} args.key The provider's API key (per-request).
 * @param {string} [args.mode] `"keyword"` for the comma-separated tag-list rewrite; omit/`"fix"`
 *   for the default prose clean-up.
 * @returns {Promise<string>} The rewritten prompt.
 * @throws {Error} On a non-OK proxy response.
 */
export async function rewritePrompt({ providerId, prompt, key, mode }) {
  const res = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, prompt, key, mode }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Rewrite proxy returned ${res.status}`);
  return d.text || "";
}
