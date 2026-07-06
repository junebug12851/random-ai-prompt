/**
 * @file Unit tests for src/core/rng.js — the seeded PRNG. Covers determinism (same seed → same
 * sequence), independence (different seeds diverge), the draw helpers' bounds, and `fork` sub-streams.
 */
import { describe, it, expect } from "vitest";
import { Rng, createRng, cyrb128, sfc32 } from "../../engine/core/rng.js";

const seq = (rng, n) => Array.from({ length: n }, () => rng.float());

describe("Rng determinism", () => {
  it("produces the identical sequence for the same seed", () => {
    expect(seq(new Rng("abc"), 20)).toEqual(seq(new Rng("abc"), 20));
  });

  it("diverges for different seeds", () => {
    expect(seq(new Rng("abc"), 20)).not.toEqual(seq(new Rng("abd"), 20));
  });

  it("treats a numeric seed as its string form (1 and '1' match)", () => {
    expect(seq(new Rng(1), 10)).toEqual(seq(new Rng("1"), 10));
  });

  it("floats stay in [0, 1)", () => {
    const rng = new Rng("range");
    for (const f of seq(rng, 500)) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe("Rng draw helpers", () => {
  it("int is inclusive and order-tolerant", () => {
    const rng = new Rng("int");
    for (let i = 0; i < 300; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(new Rng("s").int(7, 3)).toBe(new Rng("s").int(3, 7)); // order-tolerant
  });

  it("chance(0) is never true and chance(1) is always true", () => {
    const rng = new Rng("chance");
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("pick returns an element; shuffle is a permutation and is deterministic", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toContain(new Rng("p").pick(arr));
    const s1 = new Rng("sh").shuffle(arr);
    const s2 = new Rng("sh").shuffle(arr);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual([...arr].sort()); // same multiset
    expect(s1).not.toBe(arr); // does not mutate input
  });
});

describe("Rng.fork", () => {
  it("same label yields the same sub-stream; different labels diverge", () => {
    const a = new Rng("root").fork("x");
    const b = new Rng("root").fork("x");
    const c = new Rng("root").fork("y");
    expect(seq(a, 10)).toEqual(seq(b, 10));
    expect(seq(new Rng("root").fork("x"), 10)).not.toEqual(seq(c, 10));
  });

  it("auto-incrementing forks are distinct and reproducible", () => {
    const p1 = new Rng("root");
    const p2 = new Rng("root");
    const a0 = seq(p1.fork(), 8);
    const a1 = seq(p1.fork(), 8);
    expect(a0).not.toEqual(a1);
    // A fresh parent with the same seed reproduces the same forks in order.
    expect(seq(p2.fork(), 8)).toEqual(a0);
    expect(seq(p2.fork(), 8)).toEqual(a1);
  });
});

describe("createRng", () => {
  it("records a random seed when none is given, and two are distinct", () => {
    const a = createRng();
    const b = createRng();
    expect(typeof a.seed).toBe("string");
    expect(a.seed).not.toBe(b.seed);
    expect(seq(createRng(a.seed), 10)).toEqual(seq(a, 10)); // replay from the recorded seed
  });

  it("an empty seed is treated as no seed (random)", () => {
    expect(createRng("").seed).not.toBe("");
  });
});

describe("primitives", () => {
  it("cyrb128 returns four unsigned 32-bit words, stable per input", () => {
    const h = cyrb128("hello");
    expect(h).toHaveLength(4);
    for (const w of h) expect(w).toBe(w >>> 0);
    expect(cyrb128("hello")).toEqual(h);
  });

  it("sfc32 is deterministic for the same state", () => {
    const [a, b, c, d] = cyrb128("state");
    const g1 = sfc32(a, b, c, d);
    const g2 = sfc32(a, b, c, d);
    expect([g1(), g1(), g1()]).toEqual([g2(), g2(), g2()]);
  });
});
