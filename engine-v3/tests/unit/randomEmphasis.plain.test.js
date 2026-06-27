/**
 * @file Unit tests for the `Plain` dialect added to randomEmphasis. Plain keeps the engine's
 * emphasis rolls but renders them as natural-language words instead of weighting syntax —
 * so a syntax-less target still receives the emphasis the engine produced. With
 * `emphasisLevelChance: 0` the level is fixed at 1 and with `deEmphasisChance: 0` the roll
 * is always the "more" branch, making the word selection deterministic.
 */
import { describe, it, expect } from "vitest";
import randomEmphasis from "../../src/helpers/randomEmphasis.js";

const base = {
  mode: "Plain",
  keywordEmphasis: true,
  emphasisLevelChance: 0, // never add extra levels → count stays 1
  emphasisMaxLevels: 3,
  deEmphasisChance: 0, // never de-emphasize → always the intensifier ladder
};

describe("randomEmphasis — Plain dialect", () => {
  it("prefixes the keyword with a natural-language intensifier (keeps emphasis, no syntax)", () => {
    const { keyword, wasUsed } = randomEmphasis(base, "red car");
    expect(wasUsed).toBe(true);
    expect(keyword).toBe("prominent red car");
    expect(keyword).not.toMatch(/[()[\]{}]|::/); // no weighting syntax leaked in
  });

  it("honors a provider-supplied wordbank override", () => {
    const { keyword } = randomEmphasis({ ...base, plainEmphasisWords: ["ULTRA"] }, "red car");
    expect(keyword).toBe("ULTRA red car");
  });

  it("does nothing when emphasis is disabled", () => {
    const { keyword, wasUsed } = randomEmphasis({ ...base, keywordEmphasis: false }, "red car");
    expect(keyword).toBe("red car");
    expect(wasUsed).toBe(false);
  });
});
