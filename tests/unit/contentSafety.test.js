/**
 * @file Unit tests for the content-safety filter (src/contentSafety.js) — the
 * whole-word/whole-phrase matcher that drives list cleanup and the SFW/NSFW split.
 */
import { describe, it, expect } from "vitest";
import {
  normalize,
  classifyRemoval,
  isNsfw,
  _sets,
} from "../../src/contentSafety.js";

describe("contentSafety.normalize", () => {
  it("lowercases and collapses separators to single spaces", () => {
    expect(normalize("Long_Hair")).toBe("long hair");
    expect(normalize("Gore-Tex")).toBe("gore tex");
    expect(normalize("  multiple   spaces  ")).toBe("multiple spaces");
  });

  it("strips punctuation and non-alphanumerics", () => {
    expect(normalize("hello!!! world???")).toBe("hello world");
    expect(normalize("a/b\\c")).toBe("a b c");
  });

  it("returns an empty string for empty/symbol-only input", () => {
    expect(normalize("")).toBe("");
    expect(normalize("!!!")).toBe("");
  });
});

describe("contentSafety.classifyRemoval", () => {
  it("flags unambiguous slurs on content lists", () => {
    expect(classifyRemoval("nigger")).toEqual({ category: "slur", term: "nigger" });
  });

  it("does NOT substring-match inside innocent words (whole-word matching)", () => {
    // "cockpit" must never be flagged for containing a fragment.
    expect(classifyRemoval("cockpit")).toBeNull();
    expect(classifyRemoval("scunthorpe")).toBeNull();
  });

  it("flags minor-sexualizing terms and phrases", () => {
    expect(classifyRemoval("loli")?.category).toBe("minor-sexual");
    expect(classifyRemoval("child porn")?.category).toBe("minor-sexual");
  });

  it("whitelists genuine false positives", () => {
    expect(classifyRemoval("lolita")).toBeNull();
    expect(classifyRemoval("al gore")).toBeNull();
    expect(classifyRemoval("gore-tex")).toBeNull();
  });

  it("treats ambiguous slurs and gore as content-only", () => {
    expect(classifyRemoval("negro", { listType: "content" })?.category).toBe("slur-ambiguous");
    expect(classifyRemoval("gore", { listType: "content" })?.category).toBe("extreme");
    // Proper-noun lists only get the unambiguous slur + minor sets, matched exactly.
    expect(classifyRemoval("negro", { listType: "proper" })).toBeNull();
    expect(classifyRemoval("gore", { listType: "proper" })).toBeNull();
  });

  it("uses EXACT (whole-entry) matching for proper-noun lists", () => {
    // A multi-word place name that merely contains a slur token survives.
    expect(classifyRemoval("Coon Rapids", { listType: "proper" })).toBeNull();
    // The bare slur entry is still removed.
    expect(classifyRemoval("coon", { listType: "proper" })?.category).toBe("slur");
  });

  it("returns null for clean ordinary content", () => {
    expect(classifyRemoval("long hair")).toBeNull();
    expect(classifyRemoval("majestic mountain landscape")).toBeNull();
  });
});

describe("contentSafety.isNsfw", () => {
  it("tags ordinary adult vocabulary as NSFW (not removed)", () => {
    expect(isNsfw("nude")).toBe(true);
    expect(isNsfw("topless woman")).toBe(true);
  });

  it("does not tag SFW content", () => {
    expect(isNsfw("landscape")).toBe(false);
    expect(isNsfw("cockpit")).toBe(false);
  });
});

describe("contentSafety lexicon export", () => {
  it("exposes the category sets for the build scripts", () => {
    expect(Array.isArray(_sets.SLURS_CORE)).toBe(true);
    expect(_sets.WHITELIST.has("lolita")).toBe(true);
  });
});
