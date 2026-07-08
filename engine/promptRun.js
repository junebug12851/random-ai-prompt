/**
 * @file
 * @brief Engine-owned, framework-agnostic prompt-run helpers — the thin layer that translates
 * app/generation settings into the shape the core engine wants and drives one or many prompt
 * generations. Shared by every target so the seed/reroll rules live in ONE place:
 *
 *   - the web SPA facade (`targets/web/frontend/lib/promptEngine.js`),
 *   - the CLI (`targets/cli/src/lib/promptRun.js`),
 *   - the local backend prompt route (`targets/web/backend/apiHandler.js` → `/api/prompt`).
 *
 * It is isomorphic: it touches neither `fs` nor the browser — it only reshapes settings and calls
 * an already-built engine instance (from `createEngine(loader)`), so it runs unchanged under Node and
 * in the browser. Keeping it here (not in a target) is what stops each new target from re-porting the
 * seed logic. There are NO magic seed values — see {@link seedFor}.
 */

/**
 * Which seed (if any) the engine should use for this call. The rule is explicit — there are NO magic
 * seed values:
 *   1. `explicitSeed` (when given) always wins. The batch roll uses this to fork one base seed into a
 *      distinct-but-reproducible sub-seed per prompt.
 *   2. Otherwise, when `randomSeed` is OFF, the run is pinned to `promptSeed` verbatim (any integer,
 *      including 0 and negatives, is honoured).
 *   3. Otherwise (random on, the default) → `undefined`: the engine stays unseeded and rerolls fresh.
 * The image-provider `seed` is NEVER used here — that's a different field.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] A caller-forced seed.
 * @returns {string|undefined} The engine seed, or undefined for a random roll.
 */
export function seedFor(settings, explicitSeed) {
  if (explicitSeed != null && explicitSeed !== "") return String(explicitSeed);
  if (settings.randomSeed === false) {
    const ps = settings.promptSeed;
    if (ps != null && String(ps).trim() !== "") return String(ps).trim();
  }
  return undefined;
}

/**
 * Translate app settings into the shape the core engine wants: the image-provider `seed` is dropped
 * (it's a different field), and the engine `seed` is resolved via {@link seedFor}.
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] A caller-forced seed (see {@link seedFor}).
 * @returns {object} Engine settings.
 */
export function forEngine(settings, explicitSeed) {
  const { seed: _imageSeed, ...base } = settings;
  const s = seedFor(settings, explicitSeed);
  return s === undefined ? base : { ...base, seed: s };
}

/**
 * Build the shared prompt-run surface over an already-booted engine. Every target that generates
 * prompts uses this instead of re-implementing the seed/reroll rules.
 * @param {{generate: Function, generateMany: Function}} engine An engine from `createEngine(loader)`.
 * @param {object} [opts]
 * @param {Function} [opts.setActiveSettings] Called with the run's settings before each generation so
 *   the engine's NSFW gating / cleanup honour the active `includeAdult` flag (Node targets pass this;
 *   the browser facade reads settings a different way and may omit it).
 * @returns {{
 *   generatePrompt: (settings: object, explicitSeed?: (string|number)) => string,
 *   generatePrompts: (settings: object) => {seed: string, prompts: string[]},
 *   expandPrompt: (prompt: string, settings: object) => string,
 *   expandPromptSeeded: (prompt: string, settings: object) => string,
 * }} The prompt-run functions.
 */
export function createPromptRun(engine, { setActiveSettings } = {}) {
  const apply = (settings) => {
    if (setActiveSettings) setActiveSettings(settings);
  };

  return {
    /**
     * Generate one prompt.
     * @param {object} settings The generation settings.
     * @param {string|number} [explicitSeed] Force this exact seed.
     * @returns {string} The generated prompt.
     */
    generatePrompt(settings, explicitSeed) {
      apply(settings);
      return engine.generate(forEngine(settings, explicitSeed));
    },

    /**
     * Generate `settings.promptCount` prompts (minimum 1) as a reproducible batch. A base seed is
     * always resolved — the explicit/pinned one, or a freshly minted random one — and the engine forks
     * it per prompt (`generateMany`), so re-running with that base reproduces the whole batch verbatim
     * (still fully random across runs when no seed is pinned).
     * @param {object} settings The generation settings (`promptCount`).
     * @returns {{seed: string, prompts: string[]}} The base seed and the generated prompts.
     */
    generatePrompts(settings) {
      apply(settings);
      let base = seedFor(settings);
      if (base === undefined) base = String(Math.floor(Math.random() * 0x7fffffff));
      const prompts = engine.generateMany(forEngine(settings, base));
      return { seed: base, prompts };
    },

    /**
     * Expand a prompt for a PREVIEW / illustrative example — always re-rolls a fresh example,
     * independent of the user's pinned seed (never reads or advances `promptSeed`). The caller's
     * settings object is never mutated.
     * @param {string} prompt The DPL/prompt to expand.
     * @param {object} settings The generation settings (seed fields are ignored).
     * @returns {string} A fresh, randomly-rolled expansion.
     */
    expandPrompt(prompt, settings) {
      apply(settings);
      return engine.generate({ ...forEngine({ ...settings, randomSeed: true }), prompt });
    },

    /**
     * Expand a prompt HONOURING the current seed settings (so a pinned roll reproduces it). Used for
     * the real negative-prompt roll (part of the generated image), not for previews.
     * @param {string} prompt The DPL/prompt to expand.
     * @param {object} settings The generation settings.
     * @returns {string} The expanded prompt (deterministic when a seed is pinned).
     */
    expandPromptSeeded(prompt, settings) {
      apply(settings);
      return engine.generate({ ...forEngine(settings), prompt });
    },
  };
}
