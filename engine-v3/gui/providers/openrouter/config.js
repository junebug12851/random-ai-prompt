/**
 * OpenRouter — text-only (prompt-rewrite) provider. One key, hundreds of models via the OpenAI-
 * compatible `/chat/completions` API; CORS-enabled, so it runs browser-direct (online-capable).
 * @module gui/providers/openrouter/config
 */
export default {
  id: "openrouter",
  label: "OpenRouter",
  rewriteLabel: "OpenRouter (gpt-4o-mini)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  textOnly: true, // rewrite/text only — no image generation, so excluded from the image picker
  loadRewrite: () =>
    import("../_shared/openaiCompatRewrite.js").then((m) =>
      m.makeChatRewrite({ baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", label: "OpenRouter" }),
    ),
};
