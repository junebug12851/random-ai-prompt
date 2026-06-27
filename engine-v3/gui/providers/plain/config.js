/**
 * Plain-text provider — config/manifest. The universal bottom rung: no API, no special grammar.
 * The engine emits a natural-language prompt (emphasis rendered as words, not syntax) and the UI
 * offers Copy-prompt — for any tool that just takes plain text (Canva, NightCafe, "ChatGPT web", …).
 * @module gui/providers/plain/config
 */
export default {
  id: "plain",
  label: "Plain text",
  tier: "plain",
  dialect: "plain",
  transport: "none",
  local: false,
  needsKey: false,
  capabilities: { copyPrompt: true },
};
