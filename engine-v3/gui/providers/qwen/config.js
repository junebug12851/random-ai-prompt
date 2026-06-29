/**
 * Alibaba Qwen (DashScope) — text-only (prompt-rewrite) provider via the OpenAI-compatible
 * DashScope endpoint; proxied (CORS not assured); online-locked, works locally.
 * @module gui/providers/qwen/config
 */
export default {
  id: "qwen",
  label: "Qwen (DashScope)",
  rewriteLabel: "Qwen (qwen-plus)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
