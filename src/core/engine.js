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
//   loadDynamicPrompt(key)   -> { default, suggestion_exclude? } | null
//
// The pure stages (prompt-salt, cleanup) and the random* helpers are imported
// and reused directly — only the file/plugin access is reimplemented behind the
// loader, so there is no duplicated prompt logic.
import baseSettings from "../settings.js";
import { createRng } from "./rng.js";
import { withAmbientRng } from "../helpers/random.js";
import promptSalt from "./stages/prompt-salt.js";
import cleanup from "./stages/cleanup.js";
import { makeDynamicPromptStage } from "./stages/dynamicPrompt.js";
import { makeListStage } from "./stages/list.js";
import emphasis from "./stages/emphasis.js";
import { createListStore } from "./listStore.js";

// v3-only pipeline. The legacy `<expansion>` stage was removed (v1/v2-era); the
// dynamic-prompt stage internally re-expands up to 10 passes, so one entry suffices.
// `emphasis` runs after `list` so it sees the fully expanded text (typed `()`/`[]` from the
// prompt box AND from rendered DPL blocks) and translates it into the active dialect.
const DEFAULT_ORDER = ["dynamic-prompt", "prompt-salt", "list", "emphasis", "cleanup"];

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
    emphasis,
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

  // Whether `userSettings` carries an explicit seed (a non-empty value). A seed makes the whole run
  // reproducible; without one we use the default ambient source (`Math.random`), unchanged.
  const hasSeed = (u) => u.seed != null && u.seed !== "";

  // Run one generation, optionally under a seeded ambient rng. Defaults from settings.js are merged
  // under the caller's overrides so every field the stages read is present, and a shallow copy is
  // used so per-generation mutations (auto-fx toggles, salt counter, etc.) don't leak.
  function generateOnce(userSettings, rng) {
    const run = () => {
      store.reset();
      const settings = { ...baseSettings, ...userSettings };
      return expand(settings.prompt ?? "{#random-words}", settings, {}, {});
    };
    return rng ? withAmbientRng(rng, run) : run();
  }

  /**
   * Generate a single prompt from default settings merged under the caller's overrides. When
   * `userSettings.seed` is set the result is deterministic (same seed + catalog → same prompt);
   * otherwise it draws from `Math.random` as before.
   * @param {object} [userSettings] Settings overrides (e.g. `{ prompt, mode, seed }`).
   * @returns {string} One generated prompt.
   */
  function generate(userSettings = {}) {
    return generateOnce(userSettings, hasSeed(userSettings) ? createRng(userSettings.seed) : null);
  }

  /**
   * Like {@link generate}, but always deterministic and always reports the seed used — auto-generating
   * a fresh one when `userSettings.seed` is absent. Pass the returned `seed` back as `settings.seed`
   * to reproduce the exact prompt.
   * @param {object} [userSettings] Settings overrides.
   * @returns {{prompt: string, seed: string}} The prompt and the seed that produced it.
   */
  function generateWithSeed(userSettings = {}) {
    const rng = createRng(userSettings.seed);
    return { prompt: generateOnce(userSettings, rng), seed: rng.seed };
  }

  /**
   * Generate `userSettings.promptCount` prompts (minimum 1). With a seed, each prompt gets its own
   * deterministic sub-stream (`rng.fork(i)`), so the whole batch is reproducible.
   * @param {object} [userSettings] Settings overrides.
   * @returns {string[]} The generated prompts.
   */
  function generateMany(userSettings = {}) {
    const count = Math.max(1, Number(userSettings.promptCount) || 1);
    const parent = hasSeed(userSettings) ? createRng(userSettings.seed) : null;
    return Array.from({ length: count }, (_v, i) =>
      generateOnce(userSettings, parent ? parent.fork(i) : null),
    );
  }

  /**
   * Async counterpart of {@link generateMany}: same output and seeding, but it yields to the event
   * loop between prompts so a large batch never blocks the thread. The per-prompt render itself is
   * pure CPU and stays synchronous by design (it also drives the instant live preview); this is the
   * async-capable boundary for batch work.
   * @param {object} [userSettings] Settings overrides.
   * @returns {Promise<string[]>} The generated prompts.
   */
  async function generateManyAsync(userSettings = {}) {
    const count = Math.max(1, Number(userSettings.promptCount) || 1);
    const parent = hasSeed(userSettings) ? createRng(userSettings.seed) : null;
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(generateOnce(userSettings, parent ? parent.fork(i) : null));
      if (i + 1 < count) await Promise.resolve(); // yield between prompts
    }
    return out;
  }

  return { expand, generate, generateWithSeed, generateMany, generateManyAsync };
}
