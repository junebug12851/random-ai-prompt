/**
 * @file
 * @brief Prompt generation for the CLI — a faithful Node port of the SPA's `promptEngine.js` seed +
 * chaos logic (that module can't be imported here: it wires the browser runtime loader, which uses
 * Vite globs). Same rules, same results: chaos scaling, the explicit no-magic-seed policy, and the
 * image `seed` kept out of the engine. Runs over the shared Node engine (`boot()` → nodeLoader), so
 * the CLI, engine, and GUI produce identical prompts for the same settings + seed.
 */
import { boot, setActiveSettings } from "./engine.js";

/**
 * Scale the emphasis / alternating knobs by `settings.chaos` (mirrors the GUI + `--chaos`).
 * @param {object} settings The generation settings.
 * @returns {object} The (possibly) chaos-scaled settings.
 */
function withChaos(settings) {
  const c = Number(settings.chaos);
  if (!c || c === 1) return settings;
  return {
    ...settings,
    emphasisChance: settings.emphasisChance * c,
    emphasisLevelChance: settings.emphasisLevelChance * c,
    emphasisMaxLevels: Math.round(settings.emphasisMaxLevels * c),
    deEmphasisChance: Math.min(0.5, Math.max(0.25, settings.deEmphasisChance * c)),
    keywordAlternatingMaxLevels: Math.round(settings.keywordAlternatingMaxLevels * c),
  };
}

/**
 * Which seed (if any) the engine should use. No magic values: an explicit seed wins; else when
 * `randomSeed` is off the run pins to `promptSeed`; else undefined (fresh reroll). The image-provider
 * `seed` is never used here.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] A caller-forced seed.
 * @returns {string|undefined} The engine seed, or undefined.
 */
function seedFor(settings, explicitSeed) {
  if (explicitSeed != null && explicitSeed !== "") return String(explicitSeed);
  if (settings.randomSeed === false) {
    const ps = settings.promptSeed;
    if (ps != null && String(ps).trim() !== "") return String(ps).trim();
  }
  return undefined;
}

/**
 * Translate settings into the engine's shape: chaos-scaled, image `seed` dropped, engine `seed`
 * resolved via {@link seedFor}.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] A caller-forced seed.
 * @returns {object} Engine settings.
 */
function forEngine(settings, explicitSeed) {
  const { seed: _imageSeed, ...base } = withChaos(settings);
  const s = seedFor(settings, explicitSeed);
  return s === undefined ? base : { ...base, seed: s };
}

/**
 * Generate one prompt.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] Force this exact seed.
 * @returns {string} The generated prompt.
 */
export function generatePrompt(settings, explicitSeed) {
  setActiveSettings(settings);
  return boot().generate(forEngine(settings, explicitSeed));
}

/**
 * Generate `settings.promptCount` prompts (minimum 1) as a reproducible batch. A base seed is always
 * resolved — the explicit/pinned one, or a freshly minted random one — and the engine forks it per
 * prompt (`generateMany`), so re-running with `--seed <base>` reproduces the whole batch verbatim
 * (still fully random across runs when no seed is pinned). Mirrors the GUI's batch roll.
 * @param {object} settings The generation settings (`promptCount`).
 * @returns {{seed: string, prompts: string[]}} The base seed and the generated prompts.
 */
export function generatePrompts(settings) {
  setActiveSettings(settings);
  const engine = boot();
  let base = seedFor(settings);
  if (base === undefined) base = String(Math.floor(Math.random() * 0x7fffffff));
  const es = forEngine(settings, base); // seed = base; generateMany forks it per prompt
  const prompts = engine.generateMany(es);
  return { seed: base, prompts };
}

/**
 * Expand a prompt HONOURING the current seed settings (used for the real negative-prompt roll).
 * @param {string} prompt The DPL/prompt to expand.
 * @param {object} settings The generation settings.
 * @returns {string} The expanded prompt.
 */
export function expandPromptSeeded(prompt, settings) {
  setActiveSettings(settings);
  return boot().generate({ ...forEngine(settings), prompt });
}
