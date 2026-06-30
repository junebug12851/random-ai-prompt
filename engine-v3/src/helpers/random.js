/**
 * @file
 * @brief Engine randomness — the single source of every non-deterministic draw in the prompt
 * pipeline (the stages, the keyword randomizers, the suggestion builder, the salt). Each function
 * reads the live `Math.random`, so a test can pin the ENTIRE engine deterministically by swapping
 * `Math.random` for a seeded sequence (see tests/helpers/seededRandom.js `withSeed`).
 *
 * Do NOT use lodash's `_.random` / `_.sample` / `_.shuffle` in engine code: lodash captures a
 * reference to `Math.random` at import time, so those calls keep using the original source and
 * ignore a swapped one — which is exactly why they could never be seeded. These replacements close
 * that gap, making the whole pipeline (emphasis included) reproducible under a seed.
 */

/** A uniform float in [0, 1) — the probability-roll primitive (replaces `_.random(0, 1, true)`). */
export function randomFloat() {
  return Math.random();
}

/** A uniform integer in [min, max] inclusive (replaces `_.random(min, max)`); order-tolerant. */
export function randomInt(min, max) {
  if (min > max) [min, max] = [max, min];
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** A uniformly random element of `arr` (undefined for an empty array) — replaces `_.sample`. */
export function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A new array with `arr`'s elements in uniformly random order (Fisher–Yates) — replaces `_.shuffle`. */
export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
