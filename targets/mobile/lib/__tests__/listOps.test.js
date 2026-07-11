/**
 * @file Unit tests for the mobile list-editor ops (lib/listOps.js) — sort, dedupe, AI-candidate parse +
 * merge. Ported from the web; kept behaviorally identical (the parity check asserts the lockstep).
 */
import { parseAiCandidates, mergeNew, dedupeLines, sortLines } from "../listOps.js";

describe("listOps", () => {
  it("parseAiCandidates strips list prefixes, one per line", () => {
    expect(parseAiCandidates("- red\n2. green\n• blue")).toEqual(["red", "green", "blue"]);
  });

  it("parseAiCandidates falls back to comma-split for a single line", () => {
    expect(parseAiCandidates("red, green, blue")).toEqual(["red", "green", "blue"]);
  });

  it("mergeNew returns only case-insensitively new entries, de-duped, in order", () => {
    expect(mergeNew(["Red", "green"], ["red", "BLUE", "blue", "Green"])).toEqual(["BLUE"]);
  });

  it("dedupeLines keeps first occurrence + original order and counts removed", () => {
    expect(dedupeLines(["a", "A", "b", " a ", "b"])).toEqual({ lines: ["a", "b"], removed: 3 });
  });

  it("sortLines sorts case-insensitively without mutating the input", () => {
    const input = ["banana", "Apple", "cherry"];
    expect(sortLines(input)).toEqual(["Apple", "banana", "cherry"]);
    expect(input).toEqual(["banana", "Apple", "cherry"]);
  });
});
