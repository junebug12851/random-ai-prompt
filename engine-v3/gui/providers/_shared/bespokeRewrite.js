/**
 * Bespoke prompt-rewrite adapters for providers that take a simple key but DON'T speak the OpenAI
 * `/chat/completions` shape — Anthropic (Messages API, `x-api-key` + `anthropic-version`) and Cohere
 * (v2 `/chat`, Bearer). Both are plain-key auth (no OAuth / signing), used server-side by the
 * `/api/rewrite` proxy. Each returns `{ text }` like the OpenAI-compatible factory.
 * @module gui/providers/_shared/bespokeRewrite
 */
import { REWRITE_SYSTEM } from "./rewriteSystem.js";

/**
 * Anthropic Claude — Messages API rewrite.
 * @param {object} args `{ prompt, key, system?, model? }`.
 * @returns {Promise<{text: string}>}
 */
export async function anthropicRewrite({ prompt, key, system, model }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || "claude-3-5-haiku-latest",
      max_tokens: 1024,
      system: system || REWRITE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error?.message || `Anthropic returned ${res.status}`);
  const text = (d?.content || [])
    .map((c) => c?.text)
    .filter(Boolean)
    .join("")
    .trim();
  if (!text) throw new Error("Anthropic returned no rewrite.");
  return { text };
}

/**
 * Cohere — v2 chat rewrite.
 * @param {object} args `{ prompt, key, system?, model? }`.
 * @returns {Promise<{text: string}>}
 */
export async function cohereRewrite({ prompt, key, system, model }) {
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model || "command-r-08-2024",
      messages: [
        { role: "system", content: system || REWRITE_SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.message || `Cohere returned ${res.status}`);
  const text =
    (d?.message?.content || [])
      .map((c) => c?.text)
      .filter(Boolean)
      .join("")
      .trim() || (typeof d?.text === "string" ? d.text.trim() : "");
  if (!text) throw new Error("Cohere returned no rewrite.");
  return { text };
}
