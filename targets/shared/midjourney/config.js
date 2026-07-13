/**
 * Midjourney provider — config/manifest. **Syntax tier**: no public API, so there's no
 * `generate` — instead the engine emits a full Midjourney prompt (its `::` weighting plus
 * the `--param` flags from `code/format.js`) and the UI offers "Copy prompt". If an official
 * MJ API ever lands, drop a `code/generate.js` + `transport: "hosted-proxy"` here — no other
 * change needed.
 * @module gui/providers/midjourney/config
 */
export default {
  id: "midjourney",
  label: "Midjourney",
  description: "No API — copies a full Midjourney prompt to paste into Discord.",
  tier: "syntax",
  dialect: "midjourney",
  transport: "none",
  local: false,
  needsKey: false,

  capabilities: {
    copyPrompt: true, // no API — the UI surfaces a Copy-prompt action
    parameters: true, // full --param support (see data/)
  },

  loadFormat: () => import("./code/format.js").then((m) => m.default),
  loadSettings: () => import("./settings.js").then((m) => m.default),
};
