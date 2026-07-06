/**
 * Moonshot AI / Kimi — text-only (prompt-rewrite) provider. OpenAI-compatible chat; proxied (CORS
 * not assured); online-locked, works locally.
 * @module gui/providers/moonshot/config
 */
export default {
  id: "moonshot",
  label: "Moonshot / Kimi",
  rewriteLabel: "Moonshot (moonshot-v1-8k)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
