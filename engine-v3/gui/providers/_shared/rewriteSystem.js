/**
 * Shared system instructions for the "rewrite" text-provider feature. Two modes:
 *   - `fix` (default): turn a raw, mechanical (DPL-generated) prompt into a cleaner, better-structured
 *     image-generation prompt.
 *   - `keyword`: distil the prompt into a flat, comma-separated keyword/tag list (Booru/SD tag style),
 *     used by the prompt-screen keyword toggle and the single-view "rebuild keywords" button.
 * @module gui/providers/_shared/rewriteSystem
 */
export const REWRITE_SYSTEM =
  "You are a prompt engineer for text-to-image models. Rewrite the user's raw, mechanical prompt into " +
  "ONE clean, well-structured image-generation prompt that will produce a better result: fix grammar, " +
  "remove redundancy and contradictions, group related ideas, and keep every important subject, style, " +
  "and detail. Reply with ONLY the rewritten prompt — no preamble, no quotes, no explanation.";

export const KEYWORD_SYSTEM =
  "You convert image-generation prompts into a clean keyword/tag list. Break the user's prompt into its " +
  "distinct concepts — subjects, attributes, setting, style, lighting, composition, medium, quality — and " +
  "output them as a single comma-separated list of short lowercase tags (one to a few words each). Remove " +
  "weighting syntax such as parentheses, brackets, ':1.2' weights, and LoRA/embedding tags; expand them to " +
  "their plain meaning. No duplicates, no numbering, no sentences. Reply with ONLY the comma-separated " +
  "keywords — no preamble, no quotes, no explanation.";

/**
 * The system instruction for a rewrite mode.
 * @param {string} [mode] `"keyword"` for the tag list, anything else (default) for the prose fix.
 * @returns {string} The system prompt text.
 */
export function systemFor(mode) {
  return mode === "keyword" ? KEYWORD_SYSTEM : REWRITE_SYSTEM;
}
