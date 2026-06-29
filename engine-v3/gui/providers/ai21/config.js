/**
 * AI21 Labs (Jamba) — text-only (prompt-rewrite) provider. OpenAI-compatible chat at
 * `studio/v1/chat/completions`; proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/ai21/config
 */
export default {
  id: "ai21",
  label: "AI21 Labs",
  rewriteLabel: "AI21 (jamba-large)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
