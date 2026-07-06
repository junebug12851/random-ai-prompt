/**
 * @file Unit tests for src/helpers/randomEmphasis.js across every dialect
 * (StableDiffusion / NovelAI / Midjourney / Plain). The `Plain` branch has its
 * own dedicated file (randomEmphasis.plain.test.js); this covers the syntax
 * dialects + the cross-cutting on/off + level/de-emphasis behaviour.
 *
 * RNG landmine: lodash captured Math.random at import, so `_.random` can't be
 * stubbed. We pin behaviour with the comparison extremes instead — `_.random(0,1,true)`
 * is always in [0,1), so a chance of 0 makes `x < 0` always false (one level, never
 * de-emphasis) and a chance of 1 makes `x < 1` always true (climb to the level cap /
 * always de-emphasis). Both are deterministic with no flake.
 */
import { describe, it, expect } from "vitest";
import randomEmphasis from "../../engine/helpers/randomEmphasis.js";

/** Settings preset: emphasis on, never de-emphasize, exactly one level. */
const oneLevelEmph = (mode) => ({
  keywordEmphasis: true,
  mode,
  deEmphasisChance: 0, // x < 0 → always false → emphasis (not de-emphasis)
  emphasisLevelChance: 0, // x < 0 → always false → exactly one level
  emphasisMaxLevels: 3,
});

/** Settings preset: emphasis on, always de-emphasize, exactly one level. */
const oneLevelDeEmph = (mode) => ({ ...oneLevelEmph(mode), deEmphasisChance: 1 });

/** Settings preset: climb to the level cap. */
const maxLevels = (mode, levels) => ({
  ...oneLevelEmph(mode),
  emphasisLevelChance: 1, // x < 1 → always true → climb until count === maxLevels
  emphasisMaxLevels: levels,
});

describe("randomEmphasis — disabled", () => {
  it("returns the keyword untouched with wasUsed:false when keywordEmphasis is off", () => {
    for (const mode of ["StableDiffusion", "NovelAI", "Midjourney", "Plain"]) {
      const r = randomEmphasis({ keywordEmphasis: false, mode }, "fox");
      expect(r).toEqual({ keyword: "fox", wasUsed: false });
    }
  });
});

describe("randomEmphasis — StableDiffusion", () => {
  it("wraps in one paren level for emphasis", () => {
    const r = randomEmphasis(oneLevelEmph("StableDiffusion"), "fox");
    expect(r.keyword).toBe("(fox)");
    expect(r.wasUsed).toBe(true);
  });

  it("wraps in one bracket level for de-emphasis", () => {
    expect(randomEmphasis(oneLevelDeEmph("StableDiffusion"), "fox").keyword).toBe("[fox]");
  });

  it("climbs to exactly emphasisMaxLevels nested parens", () => {
    const r = randomEmphasis(maxLevels("StableDiffusion", 3), "fox");
    expect(r.keyword).toBe("(((fox)))");
  });

  it("respects a maxLevels of 1 (no climb past the cap)", () => {
    expect(randomEmphasis(maxLevels("StableDiffusion", 1), "fox").keyword).toBe("(fox)");
  });
});

describe("randomEmphasis — NovelAI", () => {
  it("uses paren nesting like SD (the list stage rewrites () to {} later)", () => {
    expect(randomEmphasis(oneLevelEmph("NovelAI"), "fox").keyword).toBe("(fox)");
    expect(randomEmphasis(oneLevelDeEmph("NovelAI"), "fox").keyword).toBe("[fox]");
    expect(randomEmphasis(maxLevels("NovelAI", 2), "fox").keyword).toBe("((fox))");
  });
});

describe("randomEmphasis — Midjourney", () => {
  it("appends ::factor (1.05 up, ~0.95 down) at one level", () => {
    expect(randomEmphasis(oneLevelEmph("Midjourney"), "fox").keyword).toBe("fox::1.05");
    expect(randomEmphasis(oneLevelDeEmph("Midjourney"), "fox").keyword).toBe("fox::0.95");
  });

  it("scales the factor with the level count", () => {
    // count 3 → 1.05 * 3 = 3.15
    expect(randomEmphasis(maxLevels("Midjourney", 3), "fox").keyword).toBe("fox::3.15");
  });
});

describe("randomEmphasis — Plain (edge cases beyond the dedicated file)", () => {
  it("uses a custom emphasis ladder when provided", () => {
    const s = { ...oneLevelEmph("Plain"), plainEmphasisWords: ["loud"] };
    expect(randomEmphasis(s, "fox").keyword).toBe("loud fox");
  });

  it("caps at the strongest ladder word when the level exceeds the ladder length", () => {
    // maxLevels 5 but a 2-word ladder → deepest level still uses the last word.
    const s = { ...maxLevels("Plain", 5), plainEmphasisWords: ["a", "b"] };
    expect(randomEmphasis(s, "fox").keyword).toBe("b fox");
  });

  it("uses the de-emphasis ladder for hedging", () => {
    const s = { ...oneLevelDeEmph("Plain"), plainDeEmphasisWords: ["faint"] };
    expect(randomEmphasis(s, "fox").keyword).toBe("faint fox");
  });
});

describe("randomEmphasis — unknown mode", () => {
  it("leaves the keyword unchanged but marks it used (no dialect matched)", () => {
    const r = randomEmphasis(oneLevelEmph("ComfyUI"), "fox");
    expect(r).toEqual({ keyword: "fox", wasUsed: true });
  });
});
