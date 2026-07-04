/**
 * @file Unit tests for src/helpers/random.js — the ambient-RNG seam. Covers the global-slot
 * install/restore (withAmbientRng), the get/set accessors, and that every draw helper reads the
 * ambient source (so a seeded generation is deterministic).
 */
import { describe, it, expect, afterEach } from "vitest";
import { createRng } from "../../src/core/rng.js";
import {
  withAmbientRng,
  setAmbientRng,
  getAmbientRng,
  randomFloat,
  randomInt,
  sample,
  shuffle,
} from "../../src/helpers/random.js";

// The ambient generator lives on a process-global slot; make sure a test never leaks it.
afterEach(() => setAmbientRng(null));

describe("ambient install / restore", () => {
  it("defaults to no ambient (null)", () => {
    expect(getAmbientRng()).toBeNull();
  });

  it("withAmbientRng installs for the callback and restores afterward (even on throw)", () => {
    const rng = createRng("k");
    let inside = null;
    withAmbientRng(rng, () => {
      inside = getAmbientRng();
    });
    expect(inside).toBe(rng);
    expect(getAmbientRng()).toBeNull();

    expect(() =>
      withAmbientRng(rng, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(getAmbientRng()).toBeNull(); // restored despite the throw
  });

  it("nests: the inner scope restores the outer generator", () => {
    const outer = createRng("outer");
    const inner = createRng("inner");
    withAmbientRng(outer, () => {
      withAmbientRng(inner, () => {
        expect(getAmbientRng()).toBe(inner);
      });
      expect(getAmbientRng()).toBe(outer);
    });
  });

  it("setAmbientRng sets the global source directly", () => {
    const rng = createRng("s");
    setAmbientRng(rng);
    expect(getAmbientRng()).toBe(rng);
  });
});

describe("draw helpers read the ambient source", () => {
  it("randomFloat is deterministic under a seeded ambient and falls back to Math.random otherwise", () => {
    const seq = () =>
      withAmbientRng(createRng("seq"), () => [randomFloat(), randomFloat(), randomFloat()]);
    expect(seq()).toEqual(seq());
    // Without an ambient, it still returns floats in [0, 1).
    const v = randomFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("randomInt stays within the inclusive range and is order-tolerant", () => {
    withAmbientRng(createRng("i"), () => {
      for (let n = 0; n < 50; n++) {
        const v = randomInt(3, 7);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      }
      expect(randomInt(7, 3)).toBeGreaterThanOrEqual(3); // swapped bounds tolerated
    });
  });

  it("sample returns a member; shuffle is a permutation and is reproducible under a seed", () => {
    const arr = [1, 2, 3, 4, 5];
    withAmbientRng(createRng("p"), () => {
      expect(arr).toContain(sample(arr));
    });
    const once = withAmbientRng(createRng("perm"), () => shuffle(arr));
    const twice = withAmbientRng(createRng("perm"), () => shuffle(arr));
    expect(once).toEqual(twice); // same seed → same order
    expect([...once].sort()).toEqual([...arr].sort()); // same elements
    expect(arr).toEqual([1, 2, 3, 4, 5]); // source not mutated
  });
});
