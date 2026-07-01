/**
 * @file
 * @brief Engine randomness — the single source of every non-deterministic draw in the prompt
 * pipeline (the stages, the keyword randomizers, the suggestion builder, the salt, the DPL renderer).
 *
 * Every function reads from the **ambient** random source. By default that is the global
 * `Math.random` (so unseeded generation behaves exactly as before, and a test that swaps
 * `Math.random` still works). During a *seeded* generation the engine installs an {@link Rng} as the
 * ambient source via {@link withAmbientRng}, so the entire pipeline draws from one seeded stream and
 * the run is reproducible. This is why the engine no longer needs to monkey-patch `Math.random`.
 *
 * Do NOT use lodash's `_.random` / `_.sample` / `_.shuffle` in engine code: lodash captures a
 * reference to `Math.random` at import time, so those calls keep using the original source and
 * ignore the ambient one — which is exactly why they can never be seeded. Use these replacements.
 * @see src/core/rng.js
 */

/** The current ambient generator, or null to fall back to `Math.random`. @type {import("../core/rng.js").Rng|null} */
let ambient = null;

/**
 * Install `rng` as the ambient source for the duration of `fn`, restoring the previous source
 * afterward (even if `fn` throws). Nestable. This is how the engine scopes a seeded stream to a
 * single generation.
 * @param {import("../core/rng.js").Rng|null} rng The generator to make ambient (null → `Math.random`).
 * @param {() => T} fn The work to run.
 * @returns {T} Whatever `fn` returns.
 * @template T
 */
export function withAmbientRng(rng, fn) {
  const prev = ambient;
  ambient = rng;
  try {
    return fn();
  } finally {
    ambient = prev;
  }
}

/** @param {import("../core/rng.js").Rng|null} rng Set the ambient generator (null → `Math.random`). */
export function setAmbientRng(rng) {
  ambient = rng;
}

/** @returns {import("../core/rng.js").Rng|null} The current ambient generator (null → `Math.random`). */
export function getAmbientRng() {
  return ambient;
}

/** A uniform float in [0, 1) from the ambient source — the probability-roll primitive. */
export function randomFloat() {
  return ambient ? ambient.float() : Math.random();
}

/** A uniform integer in [min, max] inclusive; order-tolerant. */
export function randomInt(min, max) {
  if (min > max) [min, max] = [max, min];
  return min + Math.floor(randomFloat() * (max - min + 1));
}

/** A uniformly random element of `arr` (undefined for an empty array). */
export function sample(arr) {
  return arr[Math.floor(randomFloat() * arr.length)];
}

/** A new array with `arr`'s elements in uniformly random order (Fisher–Yates). */
export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
