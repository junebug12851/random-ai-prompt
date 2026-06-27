/**
 * Google Gemini — server-side prompt rewrite adapter (auto-fix). Uses a text model via
 * generateContent with a system instruction.
 * @module gui/providers/gemini/code/rewrite
 */
import { REWRITE_SYSTEM } from "../../_shared/rewriteSystem.js";

/**
 * @param {object} args `{ prompt, key, model }`.
 * @returns {Promise<{text: string}>}
 */
export default async function rewrite({ prompt, key, model }) {
  const m = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: REWRITE_SYSTEM }] },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error?.message || `Gemini rewrite returned ${res.status}`);
  const text = (d?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no rewrite.");
  return { text };
}
