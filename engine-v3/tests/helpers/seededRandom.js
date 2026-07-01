/**
 * @file
 * Deterministic randomness for tests. The engine draws through an *ambient* random source
 * (`src/helpers/random.js`) that falls back to `Math.random` when unseeded, so swapping
 * `Math.random` here still pins the whole pipeline — which is what lets the snapshot suite
 * assert exact output. (Seeded generation proper is exercised via `settings.seed` +
 * `src/core/rng.js`; this helper covers the legacy Math.random-swap path the snapshots use.)
 */

/**
 * mulberry32 — a tiny, fast, well-distributed seedable PRNG.
 * @param {number} seed 32-bit integer seed.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replace `Math.random` with a seeded sequence for the duration of `fn`, then restore it.
 * @param {number} seed The PRNG seed.
 * @param {() => T} fn The work to run with deterministic randomness.
 * @returns {T} Whatever `fn` returns.
 * @template T
 */
export function withSeed(seed, fn) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
