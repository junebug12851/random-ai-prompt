/**
 * Fireworks AI — text-only (prompt-rewrite) provider. OpenAI-compatible chat, proxied (CORS not
 * assured); online-locked, works locally. Server adapter in server/dispatch.js.
 * @module gui/providers/fireworks/config
 */
export default {
  id: "fireworks",
  label: "Fireworks AI",
  rewriteLabel: "Fireworks (Llama-3.3-70B)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
