/**
 * @file Unit tests for src/listManifest.js — the pure list-resolution core
 * (name resolution, SFW/NSFW model, composite groups, the natural-order comparator).
 */
import { describe, it, expect } from "vitest";
import {
  compareNames,
  allListNames,
  resolveName,
  isReservedWildcard,
  logicalListNames,
  autoGroupListDirs,
  resolveListLines,
  computeButtonNames,
  hasVariantSuffix,
  RESERVED_WILDCARD,
} from "../../engine/listManifest.js";

describe("compareNames (natural order: symbols < numbers < letters)", () => {
  it("orders numbers numerically, not lexically", () => {
    expect(["10", "2", "1"].sort(compareNames)).toEqual(["1", "2", "10"]);
  });

  it("orders symbols before digits before letters", () => {
    const sorted = ["apple", "1one", "_under"].sort(compareNames);
    expect(sorted).toEqual(["_under", "1one", "apple"]);
  });

  it("is alphabetical among letters", () => {
    expect(["banana", "apple", "cherry"].sort(compareNames)).toEqual(["apple", "banana", "cherry"]);
  });
});

describe("allListNames", () => {
  it("dedupes and sorts in natural order", () => {
    expect(allListNames(["b", "a", "b", "10", "2"])).toEqual(["2", "10", "a", "b"]);
  });
});

describe("resolveName", () => {
  const names = ["danbooru/d/general", "color", "look/expression", "place/place"];

  it("returns an exact match unchanged", () => {
    expect(resolveName("color", names)).toBe("color");
    expect(resolveName("danbooru/d/general", names)).toBe("danbooru/d/general");
  });

  it("resolves a bare name by path suffix", () => {
    expect(resolveName("general", names)).toBe("danbooru/d/general");
    expect(resolveName("expression", names)).toBe("look/expression");
  });

  it("prefers the shallowest path on ambiguity", () => {
    const ns = ["a/x/thing", "b/thing"];
    expect(resolveName("thing", ns)).toBe("b/thing");
  });

  it("returns the ref unchanged when nothing matches", () => {
    expect(resolveName("nope", names)).toBe("nope");
  });

  it("never resolves the reserved keyword wildcard to a file path", () => {
    expect(resolveName("keyword", ["danbooru/d/keyword"])).toBe("keyword");
  });
});

describe("isReservedWildcard / hasVariantSuffix", () => {
  it("recognizes the keyword wildcard and its variants", () => {
    expect(isReservedWildcard("keyword")).toBe(true);
    expect(isReservedWildcard("keyword-sfw")).toBe(true);
    expect(isReservedWildcard("keyword-nsfw")).toBe(true);
    expect(isReservedWildcard("keyword2")).toBe(false);
    expect(RESERVED_WILDCARD).toBe("keyword");
  });

  it("detects variant suffixes", () => {
    expect(hasVariantSuffix("foo-sfw")).toBe(true);
    expect(hasVariantSuffix("foo-nsfw")).toBe(true);
    expect(hasVariantSuffix("foo")).toBe(false);
  });
});

describe("logicalListNames (SFW/NSFW naming model + safety rule)", () => {
  it("derives the reference set and ignores stray plain files beside an -nsfw sibling", () => {
    const physical = ["color", "foo-sfw", "foo-nsfw", "bar-nsfw", "baz", "baz-nsfw"];
    const logical = logicalListNames(physical);
    expect(logical).toContain("color");
    // genuine mixed pair exposes base + both variants
    expect(logical).toContain("foo");
    expect(logical).toContain("foo-sfw");
    expect(logical).toContain("foo-nsfw");
    // NSFW-only (no -sfw counterpart) exposed by its gated name only
    expect(logical).toContain("bar-nsfw");
    expect(logical).not.toContain("bar");
    // safety rule: a plain `baz` beside `baz-nsfw` is dropped entirely
    expect(logical).not.toContain("baz");
    expect(logical).toContain("baz-nsfw");
  });
});

describe("autoGroupListDirs", () => {
  it("marks a folder with 2+ direct lists as an implied group", () => {
    expect(autoGroupListDirs(["foo/a", "foo/b", "bar/a"])).toEqual(["foo"]);
  });

  it("honors enable/disable marker overrides", () => {
    expect(autoGroupListDirs(["bar/a"], ["bar"], [])).toContain("bar");
    expect(autoGroupListDirs(["foo/a", "foo/b"], [], ["foo"])).not.toContain("foo");
  });

  it("collapses sfw/nsfw variants when counting members", () => {
    // one logical list (x) stored as a pair -> not a group
    expect(autoGroupListDirs(["d/x-sfw", "d/x-nsfw"])).toEqual([]);
  });
});

describe("resolveListLines (SFW/NSFW resolution)", () => {
  const lines = { "x-sfw": ["a", "b"], "x-nsfw": ["c"] };
  const readers = {
    names: ["x", "x-sfw", "x-nsfw"],
    readListFile: (n) => lines[n] ?? null,
    readGroupFile: () => null,
  };

  it("returns SFW only when adult is off", () => {
    expect(resolveListLines("x", readers, false)).toEqual(["a", "b"]);
  });

  it("includes NSFW when adult is on", () => {
    expect(resolveListLines("x", readers, true)).toEqual(["a", "b", "c"]);
  });

  it("makes an explicit -nsfw reference invisible when adult is off", () => {
    expect(resolveListLines("x-nsfw", readers, false)).toEqual([]);
  });

  it("an explicit -sfw reference is always SFW only", () => {
    expect(resolveListLines("x-sfw", readers, true)).toEqual(["a", "b"]);
  });
});

describe("computeButtonNames", () => {
  it("uses bare filenames, growing a prefix only under a forced-prefix folder", () => {
    const names = ["color", "danbooru/d/general"];
    const out = computeButtonNames(names, ["danbooru/d"]);
    expect(out["color"]).toBe("color");
    expect(out["danbooru/d/general"]).toBe("d/general");
  });
});
