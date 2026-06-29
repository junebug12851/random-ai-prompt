/**
 * Cohere — text-only (prompt-rewrite) provider. Plain Bearer key, the v2 `/chat` API (not OpenAI-
 * compatible), so it uses a bespoke server adapter. Proxied; online-locked, works locally.
 * @module gui/providers/cohere/config
 */
export default {
  id: "cohere",
  label: "Cohere",
  rewriteLabel: "Cohere (command-r)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
