/**
 * OpenAI — server-side prompt rewrite adapter (auto-fix). Uses a chat model to clean up the
 * prompt. Key used once, never stored.
 * @module gui/providers/openai/code/rewrite
 */
import { REWRITE_SYSTEM } from "../../_shared/rewriteSystem.js";

/**
 * @param {object} args `{ prompt, key, model, system }` — `system` overrides the default fix prompt.
 * @returns {Promise<{text: string}>}
 */
export default async function rewrite({ prompt, key, model, system }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: system || REWRITE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error?.message || `OpenAI rewrite returned ${res.status}`);
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no rewrite.");
  return { text };
}
