/**
 * @file Guard test for the two built-in list aliases (src/helpers/aliases.js).
 * They are intentionally plain string constants kept dependency-free so the
 * dynamic-prompt chain stays browser-safe; this locks their values + shape.
 */
import { describe, it, expect } from "vitest";
import { keywordAlias, artistAlias } from "../../engine/helpers/aliases.js";

describe("aliases", () => {
  it("exposes the keyword and artist alias names", () => {
    expect(keywordAlias).toBe("keyword");
    expect(artistAlias).toBe("artist");
  });

  it("they are distinct non-empty strings", () => {
    expect(typeof keywordAlias).toBe("string");
    expect(typeof artistAlias).toBe("string");
    expect(keywordAlias).not.toBe(artistAlias);
  });
});
