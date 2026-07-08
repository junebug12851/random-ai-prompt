/**
 * @file
 * @brief CLI prompt rewrite (auto-fix / keyword-translate) — the Node analogue of the SPA's
 * `lib/rewrite.js`. Browser-direct text providers (OpenAI / Gemini / Grok) call their own rewrite
 * adapter directly; every other provider goes through the shared `/api/rewrite` proxy (served by the
 * in-process backend). Same behavior the GUI's auto-fix uses.
 */
import { getProvider } from "./providers.js";
import { systemFor } from "../../../web/shared/_shared/rewriteSystem.js";

/**
 * Rewrite a prompt with a text provider.
 * @param {object} args
 * @param {string} args.providerId The rewrite (text) provider id.
 * @param {string} args.prompt The prompt to rewrite.
 * @param {string} args.key The provider's API key.
 * @param {string} [args.mode] `"keyword"` for the tag-list rewrite; omit for the prose clean-up.
 * @returns {Promise<string>} The rewritten prompt (or the original on empty result).
 * @throws {Error} On a failed rewrite.
 */
export async function rewritePrompt({ providerId, prompt, key, mode }) {
  const provider = await getProvider(providerId);

  if (provider?.transport === "browser-direct" && provider.loadRewrite) {
    const rewrite = await provider.loadRewrite();
    const { text } = await rewrite({ prompt, key, system: systemFor(mode) });
    return text || "";
  }

  // Fallback: the shared proxy on the in-process backend (relative URL resolved by the fetch shim).
  const res = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, prompt, key, mode }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Rewrite proxy returned ${res.status}`);
  return d.text || "";
}
