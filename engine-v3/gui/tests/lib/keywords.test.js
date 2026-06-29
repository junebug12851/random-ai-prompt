/**
 * @file Unit tests for gui/src/lib/keywords.js — turning a weighted, attention-laden
 * prompt into clean, de-duplicated display tags (with accent-folded match keys).
 */
import { describe, it, expect } from "vitest";
import {
  keywordKey,
  parseKeywords,
  extractKeywords,
  normalizeKeywordList,
} from "../../src/lib/keywords.js";

describe("keywordKey", () => {
  it("de-accents and lowercases for matching", () => {
    expect(keywordKey("Café")).toBe("cafe");
    expect(keywordKey("naïve")).toBe("naive");
  });
  it("collapses whitespace and trims", () => {
    expect(keywordKey("  long   hair ")).toBe("long hair");
  });
  it("passes non-Latin scripts through, lowercased", () => {
    expect(keywordKey("日本語")).toBe("日本語");
  });
  it("handles empty / nullish input", () => {
    expect(keywordKey("")).toBe("");
    expect(keywordKey(undefined)).toBe("");
  });
});

describe("parseKeywords — cleaning", () => {
  it("drops <lora:…> and embeddings entirely", () => {
    const out = extractKeywords("a fox, <lora:detail:0.8>, forest");
    expect(out).toEqual(["a fox", "forest"]);
  });
  it("keeps the inner text of attention brackets and strips weights", () => {
    expect(extractKeywords("(sunset:1.4)")).toEqual(["sunset"]);
    expect(extractKeywords("((bright))")).toEqual(["bright"]);
    expect(extractKeywords("[shadow]")).toEqual(["shadow"]);
    expect(extractKeywords("{glow}")).toEqual(["glow"]);
  });
  it("turns prompt-editing colons into spaces and drops BREAK/AND/pipes", () => {
    expect(extractKeywords("from:to:5")).toEqual(["from to"]);
    expect(extractKeywords("red BREAK blue")).toEqual(["red blue"]);
    expect(extractKeywords("a AND b")).toEqual(["a b"]);
    expect(extractKeywords("cat|dog")).toEqual(["cat dog"]);
  });
});

describe("parseKeywords — splitting, dedupe, limits", () => {
  it("splits on commas and newlines, keeping multi-word phrases whole", () => {
    expect(extractKeywords("looking at viewer, blue eyes")).toEqual(["looking at viewer", "blue eyes"]);
  });
  it("de-dupes by accent-folded key (café == cafe)", () => {
    const out = extractKeywords("café, cafe, CAFÉ");
    expect(out).toEqual(["café"]);
  });
  it("drops run-on fragments longer than maxLen", () => {
    const long = "x".repeat(60);
    expect(extractKeywords(`short, ${long}`)).toEqual(["short"]);
  });
  it("caps the result count", () => {
    const many = Array.from({ length: 100 }, (_, i) => `k${i}`).join(", ");
    expect(extractKeywords(many, { max: 10 })).toHaveLength(10);
  });
  it("optionally sorts by key", () => {
    expect(extractKeywords("banana, apple", { sort: true })).toEqual(["apple", "banana"]);
  });
  it("returns [] for empty / nullish input", () => {
    expect(parseKeywords("")).toEqual([]);
    expect(parseKeywords(null)).toEqual([]);
  });
  it("parseKeywords returns both display and match key", () => {
    expect(parseKeywords("Café")).toEqual([{ display: "Café", key: "cafe" }]);
  });
});

describe("normalizeKeywordList", () => {
  it("cleans + de-dupes a pre-split list", () => {
    expect(normalizeKeywordList(["(red:1.2)", "red", "blue"])).toEqual(["red", "blue"]);
  });
});
