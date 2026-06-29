/**
 * Mistral AI — text-only (prompt-rewrite) provider. OpenAI-compatible `/v1/chat/completions`,
 * proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/mistral/config
 */
export default {
  id: "mistral",
  label: "Mistral AI",
  rewriteLabel: "Mistral (small-latest)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
