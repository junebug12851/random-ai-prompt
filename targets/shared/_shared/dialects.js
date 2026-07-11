/**
 * Prompt **dialects** — the syntax a provider's prompt text is written in. A dialect is
 * the bridge between a provider and the shared engine: each maps to the engine's internal
 * `mode` (which drives `src/helpers/randomEmphasis.js` and the list stage). A provider
 * declares one `dialect`; picking the provider selects the dialect (there is no standalone
 * "Mode" control any more).
 *
 * `plain` is the universal bottom rung: it keeps the engine's emphasis rolls but renders
 * them as natural-language words instead of weighting syntax (see `randomEmphasis.js`),
 * so a service with no grammar still receives the emphasis the engine produced.
 * @module gui/providers/_shared/dialects
 */

/**
 * @typedef {object} Dialect
 * @property {string} id Stable dialect id used in provider `config.dialect`.
 * @property {string} label Human label.
 * @property {string} engineMode The engine `settings.mode` value this maps to.
 * @property {string} emphasis One-line description of how emphasis is expressed.
 */

/** @type {Record<string, Dialect>} */
export const DIALECTS = {
  sd: {
    id: "sd",
    label: "Stable Diffusion",
    engineMode: "StableDiffusion",
    emphasis: "(word) emphasis / [word] de-emphasis",
  },
  novelai: {
    id: "novelai",
    label: "NovelAI",
    engineMode: "NovelAI",
    emphasis: "{word} emphasis / [word] de-emphasis",
  },
  midjourney: {
    id: "midjourney",
    label: "Midjourney",
    engineMode: "Midjourney",
    emphasis: "word::factor weighting",
  },
  plain: {
    id: "plain",
    label: "Plain text",
    engineMode: "Plain",
    emphasis: "natural-language intensifiers (no syntax)",
  },
};

/**
 * Map a provider's `dialect` id to the engine `settings.mode` value.
 * @param {string} dialectId The dialect id (defaults to `plain` if unknown).
 * @returns {string} The engine mode.
 */
export function engineModeFor(dialectId) {
  return (DIALECTS[dialectId] || DIALECTS.plain).engineMode;
}
