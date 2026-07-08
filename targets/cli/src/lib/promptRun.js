/**
 * @file
 * @brief Prompt generation for the CLI — a thin binding of the shared, engine-owned prompt-run
 * (`engine/promptRun.js`) to the CLI's Node engine (`boot()` → nodeLoader) and its active-settings
 * hook (for NSFW gating). The seed/reroll rules live in the engine module, so the CLI, the web SPA,
 * and the local backend `/api/prompt` route produce identical prompts for the same settings + seed —
 * no re-ported logic here.
 */
import { createPromptRun } from "../../../../engine/promptRun.js";
import { boot, setActiveSettings } from "./engine.js";

let run = null;

/**
 * Lazily bind the shared prompt-run to the booted engine (idempotent).
 * @returns {ReturnType<typeof createPromptRun>} The prompt-run surface.
 */
function promptRun() {
  if (!run) run = createPromptRun(boot(), { setActiveSettings });
  return run;
}

/**
 * Generate one prompt.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] Force this exact seed.
 * @returns {string} The generated prompt.
 */
export function generatePrompt(settings, explicitSeed) {
  return promptRun().generatePrompt(settings, explicitSeed);
}

/**
 * Generate `settings.promptCount` prompts as a reproducible batch (see the shared module).
 * @param {object} settings The generation settings (`promptCount`).
 * @returns {{seed: string, prompts: string[]}} The base seed and the generated prompts.
 */
export function generatePrompts(settings) {
  return promptRun().generatePrompts(settings);
}

/**
 * Expand a prompt HONOURING the current seed settings (used for the real negative-prompt roll).
 * @param {string} prompt The DPL/prompt to expand.
 * @param {object} settings The generation settings.
 * @returns {string} The expanded prompt.
 */
export function expandPromptSeeded(prompt, settings) {
  return promptRun().expandPromptSeeded(prompt, settings);
}
