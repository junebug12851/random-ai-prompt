/**
 * Meta Llama API — text-only (prompt-rewrite) provider. Meta's hosted Llama API exposes an OpenAI-
 * compatible endpoint (`api.llama.com/compat/v1`) with a plain key; proxied (CORS not assured);
 * online-locked, works locally. Best-effort — verify the endpoint/model against current docs.
 * @module gui/providers/llama/config
 */
export default {
  id: "llama",
  label: "Meta Llama API",
  rewriteLabel: "Llama (3.3-70B)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
