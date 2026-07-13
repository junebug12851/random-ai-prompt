/**
 * NovelAI provider — config/manifest. **Syntax tier**: the engine emits the prompt in NovelAI's
 * dialect (`{word}` emphasis / `[word]` de-emphasis) and the UI offers Copy-prompt. (NovelAI's
 * own image API needs a subscription token + handles an encrypted response, so it's left as a
 * copy-prompt target for now.)
 * @module gui/providers/novelai/config
 */
export default {
  id: "novelai",
  label: "NovelAI",
  description: "No API — copies a NovelAI-dialect prompt.",
  tier: "syntax",
  dialect: "novelai",
  transport: "none",
  local: false,
  needsKey: false,
  capabilities: { copyPrompt: true },
};
