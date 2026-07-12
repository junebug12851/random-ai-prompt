/**
 * @file Unit tests for gui/src/lib/manage/listEditorOps.js — the pure list-editor operations
 * (AI-reply parsing, new-entry merge, de-dupe, sort).
 */
import { describe, it, expect } from "vitest";
import { parseAiCandidates, mergeNew, dedupeLines, sortLines } from "../../../../engine/listEditorOps.js";

describe("parseAiCandidates", () => {
  it("splits one entry per line and strips list prefixes", () => {
    const out = "- crimson\n2. teal\n* amber\n• gold";
    expect(parseAiCandidates(out)).toEqual(["crimson", "teal", "amber", "gold"]);
  });
  it("falls back to comma-separated for a single line", () => {
    expect(parseAiCandidates("crimson, teal, amber")).toEqual(["crimson", "teal", "amber"]);
  });
  it("drops blank lines and tolerates empty input", () => {
    expect(parseAiCandidates("a\n\n\nb\n")).toEqual(["a", "b"]);
    expect(parseAiCandidates("")).toEqual([]);
  });
});

describe("mergeNew", () => {
  it("returns only entries not already in the pool (case-insensitive)", () => {
    expect(mergeNew(["Red", "blue"], ["red", "green", "BLUE", "amber"])).toEqual(["green", "amber"]);
  });
  it("de-duplicates the candidates against each other", () => {
    expect(mergeNew([], ["x", "X", "y"])).toEqual(["x", "y"]);
  });
});

describe("dedupeLines", () => {
  it("keeps the first occurrence and reports the removed count", () => {
    const r = dedupeLines(["a", "A", " a ", "b", "b"]);
    expect(r.lines).toEqual(["a", "b"]);
    expect(r.removed).toBe(3);
  });
  it("reports zero removed when already unique", () => {
    expect(dedupeLines(["a", "b", "c"]).removed).toBe(0);
  });
});

describe("sortLines", () => {
  it("sorts case-insensitively without mutating the input", () => {
    const input = ["banana", "Apple", "cherry"];
    expect(sortLines(input)).toEqual(["Apple", "banana", "cherry"]);
    expect(input).toEqual(["banana", "Apple", "cherry"]); // unchanged
  });
});
