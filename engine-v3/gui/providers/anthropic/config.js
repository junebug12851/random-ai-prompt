/**
 * Anthropic Claude — text-only (prompt-rewrite) provider. Plain-key auth (`x-api-key` +
 * `anthropic-version`), the Messages API (not OpenAI-compatible), so it uses a bespoke server
 * adapter. Proxied; online-locked, works locally.
 * @module gui/providers/anthropic/config
 */
export default {
  id: "anthropic",
  label: "Anthropic Claude",
  rewriteLabel: "Claude (3.5 Haiku)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
