/**
 * DeepSeek — text-only (prompt-rewrite) provider. OpenAI-compatible `/chat/completions`. CORS is
 * not assured from a browser, so it's proxied (`rewrite: true` → the `/api/rewrite` server adapter);
 * online-locked like the other non-browser-direct providers, works locally.
 * @module gui/providers/deepseek/config
 */
export default {
  id: "deepseek",
  label: "DeepSeek",
  rewriteLabel: "DeepSeek (deepseek-chat)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true, // has a server-side rewrite adapter (registered in server/dispatch.js)
};
