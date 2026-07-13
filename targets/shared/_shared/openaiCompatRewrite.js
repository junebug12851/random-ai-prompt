/**
 * Shared OpenAI-compatible **prompt-rewrite** adapter factory. Most hosted LLM APIs (OpenRouter,
 * Groq, DeepSeek, Mistral, Together, Perplexity, Fireworks, Qwen, Kimi, …) and local servers
 * (Ollama, LM Studio, vLLM, LocalAI) speak the OpenAI `/chat/completions` shape, so a text provider
 * only needs its base URL + a default model — no per-provider code. The returned function works the
 * same in the browser (a `browser-direct` provider's `loadRewrite`) and server-side (the `/api/rewrite`
 * proxy's `rewriteAdapters`); it's a plain `fetch`, so either context is fine.
 * @module gui/providers/_shared/openaiCompatRewrite
 */
import { REWRITE_SYSTEM } from "./rewriteSystem.js";

/**
 * Build an OpenAI-compatible chat rewrite function.
 * @param {object} cfg
 * @param {string} cfg.baseUrl The API base (e.g. `https://api.groq.com/openai/v1`); `/chat/completions` is appended.
 * @param {string} cfg.model The default chat model id.
 * @param {string} [cfg.label] A human label for error messages.
 * @returns {(args: {prompt: string, key: string, system?: string, model?: string}) => Promise<{text: string}>}
 */
export function makeChatRewrite({ baseUrl, model, label }) {
  const url = `${String(baseUrl).replace(/\/+$/, "")}/chat/completions`;
  return async function rewrite({ prompt, key, system, model: modelOverride }) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelOverride || model,
        messages: [
          { role: "system", content: system || REWRITE_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        d?.error?.message || d?.message || (typeof d?.error === "string" ? d.error : null);
      throw new Error(msg || `${label || model} returned ${res.status}`);
    }
    const text = d?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`${label || model} returned no rewrite.`);
    return { text };
  };
}
