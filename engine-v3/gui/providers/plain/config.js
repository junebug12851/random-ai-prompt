/**
 * Plain-text provider — config/manifest. The universal bottom rung: no API, no special grammar.
 * The engine emits a natural-language prompt (emphasis rendered as words, not syntax) and the UI
 * offers Copy-prompt — for any tool that just takes plain text (Canva, NightCafe, "ChatGPT web", …).
 * @module gui/providers/plain/config
 */
export default {
  // Surfaced as "Unset" in the image picker: it's the no-real-provider choice — the engine just emits
  // a plain-text prompt (no image API), which is exactly "no image provider selected".
  id: "plain",
  label: "Unset",
  tier: "plain",
  dialect: "plain",
  transport: "none",
  local: false,
  needsKey: false,
  capabilities: { copyPrompt: true },
};
