/**
 * Together AI — text-only (prompt-rewrite) provider. OpenAI-compatible `/v1/chat/completions` for
 * open-source models, proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/together/config
 */
export default {
  id: "together",
  label: "Together AI",
  rewriteLabel: "Together (Llama-3.3-70B)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
