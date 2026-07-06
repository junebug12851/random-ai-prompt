/**
 * Cerebras Inference — text-only (prompt-rewrite) provider. OpenAI-compatible chat, very fast;
 * proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/cerebras/config
 */
export default {
  id: "cerebras",
  label: "Cerebras",
  rewriteLabel: "Cerebras (llama-3.3-70b)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
