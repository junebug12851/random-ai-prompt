/**
 * @file Additional listManifest.js coverage: the auto-prefix collision growth in
 * computeButtonNames, the reserved `keyword` wildcard union, and the group
 * resolution paths (union/dedup, cycle guard, the stray-base safety rule).
 * Complements the base listManifest.test.js.
 */
import { describe, it, expect } from "vitest";
import { computeButtonNames, resolveListLines } from "../../src/listManifest.js";

describe("computeButtonNames — auto-prefix collision growth", () => {
  it("grows colliding basenames out by a folder until distinct", () => {
    const names = ["a/general", "b/general"];
    const out = computeButtonNames(names);
    expect(out["a/general"]).toBe("a/general");
    expect(out["b/general"]).toBe("b/general");
  });

  it("keeps a unique basename bare alongside collisions", () => {
    const out = computeButtonNames(["a/general", "b/general", "color"]);
    expect(out["color"]).toBe("color");
  });
});

describe("resolveListLines — reserved keyword wildcard", () => {
  const data = { color: ["red"], "art/artist": ["picasso"], "danbooru/d/general": ["dan"], size: ["big"] };
  const readers = {
    names: ["color", "art/artist", "danbooru/d/general", "size"],
    readListFile: (n) => data[n] ?? null,
    readGroupFile: () => null,
  };

  it("unions general vocabulary but excludes artist and danbooru namespaces", () => {
    const out = resolveListLines("keyword", readers, false);
    expect(out).toContain("red");
    expect(out).toContain("big");
    expect(out).not.toContain("picasso");
    expect(out).not.toContain("dan");
  });
});

describe("resolveListLines — groups", () => {
  it("unions a .group file's members with de-duplication", () => {
    const data = { one: ["1", "dup"], two: ["2", "dup"] };
    const readers = {
      names: ["grp", "one", "two"],
      readListFile: (n) => data[n] ?? null,
      readGroupFile: (n) => (n === "grp" ? ["one", "two"] : null),
    };
    expect(resolveListLines("grp", readers, false).sort()).toEqual(["1", "2", "dup"]);
  });

  it("guards against a self-referential group cycle", () => {
    const data = { one: ["1"] };
    const readers = {
      names: ["grp", "one"],
      readListFile: (n) => data[n] ?? null,
      readGroupFile: (n) => (n === "grp" ? ["grp", "one"] : null),
    };
    expect(resolveListLines("grp", readers, false)).toEqual(["1"]);
  });
});

describe("resolveListLines — stray-base safety rule", () => {
  const data = { p: ["plain"], "p-nsfw": ["adult"] };
  const readers = {
    names: ["p", "p-nsfw"],
    readListFile: (n) => data[n] ?? null,
    readGroupFile: () => null,
  };

  it("ignores a stray plain <base> beside <base>-nsfw when adult is off (no SFW source)", () => {
    expect(resolveListLines("p", readers, false)).toBeNull();
  });

  it("serves only the -nsfw content when adult is on (no -sfw source)", () => {
    expect(resolveListLines("p", readers, true)).toEqual(["adult"]);
  });
});
