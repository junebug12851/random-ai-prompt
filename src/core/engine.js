/**
 * @file
 * @brief Framework-agnostic prompt engine: createEngine(loader) runs the same pipeline as the CLI over a prompt string. Notes: notes/systems/core-engine.md.
 */

// The framework-agnostic prompt engine.
//
// `createEngine(loader)` returns an engine that runs the prompt-module pipeline
// (the same stages and order as the Node CLI) over a prompt string. All data
// access â€” expansions, lists, dynamic prompts â€” goes through the injected
// `loader`, so the identical engine runs in Node (fs + createRequire loader) and
// in the browser (Vite import.meta.glob loader). See notes/plans/web-migration.md.
//
// Loader interface:
//   readExpansion(name)      -> string | null
//   readListLines(name)      -> string[] | null
//   listNames()              -> string[]
//   loadDynamicPrompt(key)   -> { default, full?, suggestion_exclude? } | null
//
// The pure stages (prompt-salt, cleanup) and the random* helpers are imported
// and reused directly â€” only the file/plugin access is reimplemented behind the
// loader, so there is no duplicated prompt logic.
import baseSettings from "../settings.js";
import promptSalt from "../prompt-modules/prompt-salt.js";
import cleanup from "../prompt-modules/cleanup.js";
import { makeExpansionStage } from "./stages/expansion.js";
import { makeDynamicPromptStage } from "./stages/dynamicPrompt.js";
import { makeListStage } from "./stages/list.js";
import { createListStore } from "./listStore.js";

const DEFAULT_ORDER = [
  "expansion",
  "dynamic-prompt",
  "expansion",
  "dynamic-prompt",
  "prompt-salt",
  "list",
  "cleanup",
];

export function createEngine(loader) {
  const store = createListStore(loader);

  const stages = {
    expansion: makeExpansionStage(loader),
    "dynamic-prompt": makeDynamicPromptStage(loader),
    "prompt-salt": promptSalt,
    list: makeListStage(store),
    cleanup,
  };

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
  function generate(userSettings = {}) {
    store.reset();
    const settings = { ...baseSettings, ...userSettings };
    const imageSettings = {};
    const upscaleSettings = {};
    return expand(settings.prompt ?? "#random", settings, imageSettings, upscaleSettings);
  }

  function generateMany(userSettings = {}) {
    const count = Math.max(1, Number(userSettings.promptCount) || 1);
    return Array.from({ length: count }, () => generate(userSettings));
  }

  return { expand, generate, generateMany };
}
