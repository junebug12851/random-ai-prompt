/**
 * @file Pure seed helpers for a prompt "roll". Kept out of the Home component so the
 * random-vs-pinned decision, per-prompt forking, and display write-back are unit-testable in
 * isolation (no React, no engine). See gui/tests/lib/homeSeed.test.js.
 */
import { randomSeed } from "../../../../../engine/core/rng.js";

/**
 * Decide the ONE base seed for a roll. When Random is off and a non-blank `promptSeed` is set, the
 * roll is pinned to that seed (reproducible); otherwise a fresh seed is minted (Random on, or an
 * empty pinned box — a roll is never a no-op). No magic values: any text is a valid seed.
 * @param {object} settings The generation settings (`randomSeed`, `promptSeed`).
 * @param {() => string} [mint] Seed generator (injectable for tests); defaults to the engine's.
 * @returns {string} The base seed for this roll.
 */
export function pickRollSeed(settings, mint = randomSeed) {
  const pinned =
    settings.randomSeed === false && String(settings.promptSeed ?? "").trim() !== "";
  return pinned ? String(settings.promptSeed).trim() : mint();
}

/**
 * The per-prompt seed for index `i` in a batch: forking one base seed keeps the prompts distinct but
 * the whole batch reproducible from the base.
 * @param {string} base The roll's base seed.
 * @param {number} i The prompt index.
 * @returns {string} The forked seed.
 */
export function forkRollSeed(base, i) {
  return `${base}#${i}`;
}

/**
 * Whether the used seed should be written back into the (greyed) seed box for display. It's a no-op
 * when it already matches, avoiding a redundant settings write per roll.
 * @param {object} settings The current settings.
 * @param {string} rollSeed The seed the roll used.
 * @returns {boolean} True when the box should be updated.
 */
export function shouldReflectSeed(settings, rollSeed) {
  return rollSeed !== settings.promptSeed;
}
