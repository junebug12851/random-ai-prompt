/**
 * Hugging Face Inference — text-only (prompt-rewrite) provider. The HF Inference **router** is
 * OpenAI-compatible (`router.huggingface.co/v1/chat/completions`) with an HF token; proxied (CORS
 * not assured); online-locked, works locally. The default model must be served by an HF provider.
 * @module gui/providers/huggingface/config
 */
export default {
  id: "huggingface",
  label: "Hugging Face",
  rewriteLabel: "Hugging Face (Llama-3.3-70B)",
  tier: "api",
  dialect: "plain",
  transport: "hosted-proxy",
  local: false,
  needsKey: true,
  textOnly: true,
  rewrite: true,
};
