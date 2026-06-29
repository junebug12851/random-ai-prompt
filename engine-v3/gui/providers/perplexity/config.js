/**
 * Perplexity — text-only (prompt-rewrite) provider. Web-grounded `sonar` chat via the OpenAI-
 * compatible `/chat/completions` API, proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/perplexity/config
 */
export default {
  id: "perplexity",
  label: "Perplexity",
  rewriteLabel: "Perplexity (sonar)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
