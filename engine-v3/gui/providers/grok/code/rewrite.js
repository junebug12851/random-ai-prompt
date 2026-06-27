/**
 * Grok (xAI) — server-side prompt rewrite adapter (auto-fix). OpenAI-compatible chat endpoint.
 * @module gui/providers/grok/code/rewrite
 */
import { REWRITE_SYSTEM } from "../../_shared/rewriteSystem.js";

/**
 * @param {object} args `{ prompt, key, model }`.
 * @returns {Promise<{text: string}>}
 */
export default async function rewrite({ prompt, key, model }) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || "grok-2-latest",
      messages: [
        { role: "system", content: REWRITE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(d?.error?.message || d?.error || `xAI rewrite returned ${res.status}`);
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Grok returned no rewrite.");
  return { text };
}
