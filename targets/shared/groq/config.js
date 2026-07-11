/**
 * Groq — text-only (prompt-rewrite) provider. Very fast inference for open models via the OpenAI-
 * compatible `/openai/v1/chat/completions` API; CORS-enabled, so browser-direct (online-capable).
 * @module gui/providers/groq/config
 */
export default {
  id: "groq",
  label: "Groq",
  rewriteLabel: "Groq (llama-3.3-70b)",
  tier: "api",
  dialect: "plain",
  transport: "browser-direct",
  local: false,
  needsKey: true,
  textOnly: true,
  loadRewrite: () =>
    import("../_shared/openaiCompatRewrite.js").then((m) =>
      m.makeChatRewrite({
        baseUrl: "https://api.groq.com/openai/v1",
        model: "llama-3.3-70b-versatile",
        label: "Groq",
      }),
    ),
};
