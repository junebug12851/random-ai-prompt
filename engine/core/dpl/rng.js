/**
 * @file
 * @brief The DPL renderer's randomness seam (`ctx.rng`). It delegates to the engine's ambient random
 * source (`src/helpers/random.js`), so a seeded generation and the default `Math.random` both flow
 * through here unchanged. See notes/reference/dpl-design.md and notes/reference/rng-design.md.
 */

import { randomFloat } from "../../helpers/random.js";

/** The DPL random seam — every method draws from the ambient source via `randomFloat`. */
export const RNG = {
  /** A float in [0, 1). */
  float: () => randomFloat(),
  /** Inclusive integer in [a, b]. */
  int: (a, b) => a + Math.floor(randomFloat() * (b - a + 1)),
  /** True with probability p (0..1). */
  chance: (p) => randomFloat() < p,
  /** A uniformly random element of arr. */
  pick: (arr) => arr[Math.floor(randomFloat() * arr.length)],
};
