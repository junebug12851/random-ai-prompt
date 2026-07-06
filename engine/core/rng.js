/**
 * @file
 * @brief The engine's seeded pseudo-random number generator — a real, self-contained PRNG that
 * makes prompt generation reproducible from a seed.
 *
 * Randomness in this project used to bottom out in the global `Math.random`, and "seeding" meant
 * swapping `Math.random` for a fixed sequence (fine for a test, but a leaky global side effect, and
 * anything that captured `Math.random` at import — e.g. lodash — escaped it). This module replaces
 * that with an explicit generator:
 *
 *   - `cyrb128(str)` hashes an arbitrary seed string into 128 bits of state.
 *   - `sfc32(a,b,c,d)` is a small, fast, well-distributed 128-bit-state generator.
 *   - `Rng` wraps them with the draw operations the pipeline needs (`float`/`int`/`chance`/`pick`/
 *     `sample`/`shuffle`), plus `fork(label)` to spin off an independent, deterministic sub-stream
 *     (used to give each prompt in a batch its own reproducible sequence).
 *
 * The engine installs one `Rng` as the *ambient* source for a generation (see
 * `src/helpers/random.js`), so every draw in the pipeline — the DPL renderer, the keyword
 * randomizers, the salt — comes from the same seeded stream and the whole run is reproducible. Given
 * the same seed and the same catalog, `Rng` produces the identical sequence in Node and the browser.
 * See notes/reference/rng-design.md.
 */

/**
 * cyrb128 — hash a string into four 32-bit unsigned integers of seed state. Public-domain algorithm
 * (bryc). Distinct strings give well-separated state, so `"1"` and `"2"` are unrelated streams.
 * @param {string} str The seed string.
 * @returns {[number, number, number, number]} Four 32-bit unsigned seed words.
 */
export function cyrb128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.codePointAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/**
 * sfc32 — Small Fast Counter, a 128-bit-state PRNG returning floats in [0, 1). Public-domain
 * (PractRand-tested). Not cryptographic — it's for reproducible content generation.
 * @param {number} a First 32-bit state word.
 * @param {number} b Second.
 * @param {number} c Third.
 * @param {number} d Fourth.
 * @returns {() => number} A function returning the next float in [0, 1).
 */
export function sfc32(a, b, c, d) {
  return function next() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = Math.trunc(a + b);
    a = b ^ (b >>> 9);
    b = Math.trunc(c + (c << 3));
    c = (c << 21) | (c >>> 11);
    d = Math.trunc(d + 1);
    t = Math.trunc(t + d);
    c = Math.trunc(c + t);
    return (t >>> 0) / 4294967296;
  };
}

/** A fresh, unpredictable seed string (crypto if available, else time + Math.random). */
export function randomSeed() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      const a = new Uint32Array(2);
      globalThis.crypto.getRandomValues(a);
      return `${a[0].toString(36)}${a[1].toString(36)}`;
    }
  } catch {
    /* fall through to the non-crypto seed */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/**
 * A seeded random source with the draw operations the pipeline uses. Construct via {@link createRng}
 * (which fills in a random seed when none is given).
 */
export class Rng {
  /**
   * @param {string|number} seed The seed (a number is stringified). Recorded as {@link Rng#seed}.
   */
  constructor(seed) {
    this.seed = String(seed);
    const [a, b, c, d] = cyrb128(this.seed);
    this._next = sfc32(a, b, c, d);
    this._forks = 0;
  }

  /** @returns {number} The next float in [0, 1). */
  float() {
    return this._next();
  }

  /**
   * @param {number} min Inclusive lower bound.
   * @param {number} max Inclusive upper bound (order-tolerant).
   * @returns {number} A uniform integer in [min, max].
   */
  int(min, max) {
    if (min > max) [min, max] = [max, min];
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /**
   * @param {number} p Probability in [0, 1].
   * @returns {boolean} True with probability `p`.
   */
  chance(p) {
    return this.float() < p;
  }

  /**
   * @param {Array<T>} arr A non-empty array.
   * @returns {T} A uniformly random element (undefined for an empty array).
   * @template T
   */
  pick(arr) {
    return arr[Math.floor(this.float() * arr.length)];
  }

  /** Alias of {@link Rng#pick} — matches the `sample` helper name. */
  sample(arr) {
    return this.pick(arr);
  }

  /**
   * @param {Array<T>} arr The source array (not mutated).
   * @returns {Array<T>} A new array in uniformly random order (Fisher–Yates).
   * @template T
   */
  shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Derive an independent, deterministic sub-stream. Two forks of the same parent with the same
   * label are identical; different labels (or the auto-incrementing counter) diverge — used to give
   * each prompt in a batch its own reproducible sequence without them sharing draws.
   * @param {string|number} [label] A stable label; defaults to an incrementing counter.
   * @returns {Rng} The child generator.
   */
  fork(label) {
    const tag = label ?? this._forks++;
    return new Rng(`${this.seed}/${tag}`);
  }
}

/**
 * Create an `Rng`. With no seed (or an empty one) a fresh random seed is generated and recorded on
 * the returned instance's `.seed`, so a caller can capture it to reproduce the run later.
 * @param {string|number} [seed] The seed; omitted → a random one.
 * @returns {Rng} The generator.
 */
export function createRng(seed) {
  const s = seed === undefined || seed === null || seed === "" ? randomSeed() : seed;
  return new Rng(s);
}
