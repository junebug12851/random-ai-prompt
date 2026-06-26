/**
 * @file
 * @brief Framework-agnostic prompt engine: createEngine(loader) runs the same pipeline as the CLI over a prompt string. Notes: notes/systems/core-engine.md.
 */

// The framework-agnostic prompt engine.
//
// `createEngine(loader)` returns an engine that runs the prompt-module pipeline
// (the same stages and order as the Node CLI) over a prompt string. All data
// access — lists, dynamic prompts — goes through the injected
// `loader`, so the identical engine runs in Node (fs + createRequire loader) and
// in the browser (Vite import.meta.glob loader). See notes/plans/web-migration.md.
//
// Loader interface:
//   readListLines(name)      -> string[] | null
//   listNames()              -> string[]
//   loadDynamicPrompt(key)   -> { default, full?, suggestion_exclude? } | null
//
// The pure stages (prompt-salt, cleanup) and the random* helpers are imported
// and reused directly — only the file/plugin access is reimplemented behind the
// loader, so there is no duplicated prompt logic.
import baseSettings from "../settings.js";
import promptSalt from "../prompt-modules/prompt-salt.js";
import cleanup from "../prompt-modules/cleanup.js";
import { makeDynamicPromptStage } from "./stages/dynamicPrompt.js";
import { makeListStage } from "./stages/list.js";
import { createListStore } from "./listStore.js";

// v3-only pipeline. The legacy `<expansion>` stage was removed (v1/v2-era); the
// dynamic-prompt stage internally re-expands up to 10 passes, so one entry suffices.
const DEFAULT_ORDER = ["dynamic-prompt", "prompt-salt", "list", "cleanup"];

/**
 * Create a framework-agnostic prompt engine that runs the same pipeline as the CLI.
 * @param {object} loader Data-access loader (Node fs or browser glob):
 *   `readListLines`, `listNames`, `loadDynamicPrompt`.
 * @returns {{expand: Function, generate: Function, generateMany: Function}} The engine API.
 */
export function createEngine(loader) {
  const store = createListStore(loader);

  const stages = {
    "dynamic-prompt": makeDynamicPromptStage(loader),
    "prompt-salt": promptSalt,
    list: makeListStage(store),
    cleanup,
  };

  /**
   * Run the prompt-module pipeline (in `settings.promptModules` order) over a prompt.
   * @param {string} prompt The seed prompt.
   * @param {object} settings The merged settings.
   * @param {object} imageSettings Per-generation image-settings scratch.
   * @param {object} upscaleSettings Per-generation upscale-settings scratch.
   * @returns {string} The fully expanded prompt.
   */
  function expand(prompt, settings, imageSettings, upscaleSettings) {
    const order = settings.promptModules || DEFAULT_ORDER;
    for (const name of order) {
      const stage = stages[name];
      if (!stage) continue;
      prompt = stage(prompt, settings, imageSettings, upscaleSettings);
    }
    // Drop stray carriage returns, like the CLI does after the pipeline.
    return prompt.replaceAll("\r", "");
  }

  // Generate a single prompt. Defaults from settings.js are merged under the
  // caller's settings so every field the stages read is present, and a shallow
  // copy is used so per-generation mutations (auto-fx toggles, etc.) don't leak.
  /**
   * Generate a single prompt from default settings merged under the caller's overrides.
   * @param {object} [userSettings] Settings overrides (e.g. `{ prompt, mode }`).
   * @returns {string} One generated prompt.
   */
  function generate(userSettings = {}) {
    store.reset();
    const settings = { ...baseSettings, ...userSettings };
    const imageSettings = {};
    const upscaleSettings = {};
    return expand(settings.prompt ?? "{#random-words}", settings, imageSettings, upscaleSettings);
  }

  /**
   * Generate `userSettings.promptCount` prompts (minimum 1).
   * @param {object} [userSettings] Settings overrides.
   * @returns {string[]} The generated prompts.
   */
  function generateMany(userSettings = {}) {
    const count = Math.max(1, Number(userSettings.promptCount) || 1);
    return Array.from({ length: count }, () => generate(userSettings));
  }

  return { expand, generate, generateMany };
}
