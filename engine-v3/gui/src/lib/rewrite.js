/**
 * Client helper for the auto-fix prompt rewrite. For a `browser-direct` text provider (OpenAI /
 * Gemini / Grok — all CORS-enabled) it loads that provider's rewrite adapter and calls the API
 * straight from the browser with the user's BYOK key, so no server is needed. Any other transport
 * falls back to the shared `/api/rewrite` proxy (the Vite dev middleware locally).
 * @module gui/lib/rewrite
 */
import { getProvider } from "./providers/index.js";
import { systemFor } from "../../providers/_shared/rewriteSystem.js";

/**
 * @param {object} args
 * @param {string} args.providerId The rewrite (text) provider id.
 * @param {string} args.prompt The prompt to clean up.
 * @param {string} args.key The provider's API key (per-request).
 * @param {string} [args.mode] `"keyword"` for the comma-separated tag-list rewrite; omit/`"fix"`
 *   for the default prose clean-up.
 * @returns {Promise<string>} The rewritten prompt.
 * @throws {Error} On a failed rewrite.
 */
export async function rewritePrompt({ providerId, prompt, key, mode }) {
  const provider = getProvider(providerId);

  // Browser-direct: call the provider's API straight from the browser (no proxy).
  if (provider?.transport === "browser-direct" && provider.loadRewrite) {
    const rewrite = await provider.loadRewrite();
    const { text } = await rewrite({ prompt, key, system: systemFor(mode) });
    return text || "";
  }

  // Fallback: the shared proxy (local dev middleware / any non-browser-direct provider).
  const res = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, prompt, key, mode }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Rewrite proxy returned ${res.status}`);
  return d.text || "";
}
