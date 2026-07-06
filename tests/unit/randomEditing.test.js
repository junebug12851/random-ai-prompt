/**
 * @file Unit tests for src/helpers/randomEditing.js (StableDiffusion prompt-editing forms).
 *
 * RNG landmine: the form (edit-in / swap / edit-out) is chosen by `_.random(0,2)`, which
 * we can't stub. We pin the step number with `keywordEditingMin === keywordEditingMax`
 * and assert the output matches exactly ONE of the three valid shapes.
 */
import { describe, it, expect } from "vitest";
import randomEditing from "../../engine/helpers/randomEditing.js";

const sd = (min, max) => ({
  keywordEditing: true,
  mode: "StableDiffusion",
  keywordEditingMin: min,
  keywordEditingMax: max,
});

describe("randomEditing — disabled / wrong mode", () => {
  it("is a no-op when keywordEditing is off", () => {
    expect(randomEditing({ keywordEditing: false, mode: "StableDiffusion" }, "fox")).toEqual({
      keyword: "fox",
      wasUsed: false,
    });
  });

  it("is a no-op for non-StableDiffusion modes", () => {
    for (const mode of ["NovelAI", "Midjourney", "Plain"]) {
      expect(randomEditing({ keywordEditing: true, mode }, "fox")).toEqual({
        keyword: "fox",
        wasUsed: false,
      });
    }
  });
});

describe("randomEditing — StableDiffusion forms", () => {
  it("emits one of the three editing shapes with the step pinned to n=3", () => {
    const r = randomEditing(sd(3, 3), "fox");
    expect(r.wasUsed).toBe(true);
    // edit-in [fox:3] | swap [fox:fox:3] | edit-out [fox::3]
    expect(r.keyword).toMatch(/^\[fox:(fox:)?3\]$|^\[fox::3\]$/);
  });

  it("keeps the step within [min,max] across many rolls", () => {
    for (let i = 0; i < 50; i++) {
      const r = randomEditing(sd(2, 4), "cat");
      const n = Number(r.keyword.match(/(\d+)\]$/)[1]);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it("covers all three forms over enough rolls", () => {
    const shapes = new Set();
    for (let i = 0; i < 200; i++) {
      const k = randomEditing(sd(1, 1), "x").keyword;
      if (k === "[x:1]") shapes.add("in");
      else if (k === "[x:x:1]") shapes.add("swap");
      else if (k === "[x::1]") shapes.add("out");
    }
    expect(shapes).toEqual(new Set(["in", "swap", "out"]));
  });
});
