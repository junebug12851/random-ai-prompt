/**
 * @file
 * @brief DPL default randomness (Math.random-based). Exposed as the `ctx.rng` seam so a
 * render can be driven by a seeded source. See notes/reference/dpl-design.md.
 */

/** Default randomness (Math.random-based, matching the v2 generators' lodash usage). */
export const RNG = {
  /** Inclusive integer in [a, b]. */
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  /** True with probability p (0..1). */
  chance: (p) => Math.random() < p,
  /** A uniformly random element of arr. */
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
};
