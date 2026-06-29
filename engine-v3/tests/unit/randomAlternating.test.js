/**
 * @file Unit tests for src/helpers/randomAlternating.js (hybrid `kw|kw` alternation).
 *
 * RNG landmine: the extra-term loop uses `_.random(0,1,true) < emphasisLevelChance`.
 * A chance of 0 makes `x < 0` always false → exactly one extra term; a chance of 1
 * makes `x < 1` always true → climb to keywordAlternatingMaxLevels. Both deterministic.
 */
import { describe, it, expect } from "vitest";
import randomAlternating from "../../src/helpers/randomAlternating.js";

const base = (mode, chance, maxLevels) => ({
  keywordAlternating: true,
  mode,
  emphasisLevelChance: chance,
  keywordAlternatingMaxLevels: maxLevels,
});

describe("randomAlternating — disabled / Midjourney", () => {
  it("is a no-op (returns the keyword, wasUsed:true) when alternating is off", () => {
    expect(randomAlternating({ keywordAlternating: false, mode: "StableDiffusion" }, "fox")).toEqual(
      { keyword: "fox", wasUsed: true },
    );
  });

  it("is a no-op for Midjourney (unsupported)", () => {
    expect(randomAlternating({ keywordAlternating: true, mode: "Midjourney" }, "fox")).toEqual({
      keyword: "fox",
      wasUsed: true,
    });
  });
});

describe("randomAlternating — StableDiffusion", () => {
  it("wraps a single-extra-term run in square brackets", () => {
    expect(randomAlternating(base("StableDiffusion", 0, 2), "fox").keyword).toBe("[fox|fox]");
  });

  it("climbs to the alternating max-levels", () => {
    // maxLevels 3 → fox|fox|fox
    expect(randomAlternating(base("StableDiffusion", 1, 3), "fox").keyword).toBe("[fox|fox|fox]");
  });
});

describe("randomAlternating — NovelAI", () => {
  it("alternates WITHOUT the SD square brackets", () => {
    expect(randomAlternating(base("NovelAI", 0, 2), "fox").keyword).toBe("fox|fox");
  });
});
