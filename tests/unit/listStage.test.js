/**
 * @file Unit tests for src/core/stages/list.js (the `{name}` stage), bound to a real
 * list store over an in-memory loader.
 *
 * The emphasis randomization path is RNG-gated; we make the no-emphasis path
 * deterministic (keywordEmphasis:false) and, for the emphasis branch, assert
 * invariants (the source word survives; NovelAI rewrites `(`→`{`).
 */
import { describe, it, expect } from "vitest";
import { makeListStage } from "../../engine/core/stages/list.js";
import { createListStore } from "../../engine/core/listStore.js";

const store = (lists) =>
  createListStore({
    readListLines: (name) => (name in lists ? lists[name].slice() : null),
    listNames: () => Object.keys(lists),
  });

const noEmph = {
  artistFilename: "artist",
  keywordsFilename: "keyword",
  includeArtist: true,
  includeAdult: false,
  listEntriesUsedOnce: true,
  keywordEmphasis: false,
  emphasisChance: 0,
  mode: "StableDiffusion",
};

describe("list stage — resolution", () => {
  it("replaces a {list} token with a list entry", () => {
    const stage = makeListStage(store({ color: ["red"] }));
    expect(stage("{color}", noEmph)).toBe("red");
  });

  it("leaves a {#name} block token intact (not a list)", () => {
    const stage = makeListStage(store({ color: ["red"] }));
    expect(stage("{#scene}", noEmph)).toBe("{#scene}");
  });

  it("resolves multiple tokens in one pass", () => {
    const stage = makeListStage(store({ color: ["red"], size: ["big"] }));
    expect(stage("{size} {color}", noEmph)).toBe("big red");
  });

  it("treats an artist token without emphasis even if keywordEmphasis is on", () => {
    const stage = makeListStage(store({ artist: ["picasso"] }));
    // includeArtist on; artist path forces emphasis=false → a clean pull.
    expect(stage("{artist}", { ...noEmph, keywordEmphasis: true, emphasisChance: 1 })).toBe(
      "picasso",
    );
  });
});

describe("list stage — emphasis branch invariants", () => {
  it("keeps the source word when emphasis is forced on (SD)", () => {
    const stage = makeListStage(store({ color: ["red"] }));
    const out = stage("{color}", { ...noEmph, keywordEmphasis: true, emphasisChance: 1 });
    expect(out).toContain("red");
  });

  it("rewrites parens to braces for NovelAI", () => {
    const stage = makeListStage(store({ color: ["red"] }));
    const out = stage("{color}", {
      ...noEmph,
      mode: "NovelAI",
      keywordEmphasis: true,
      emphasisChance: 1,
    });
    expect(out).toContain("red");
    expect(out).not.toContain("("); // any emphasis parens were converted to {}
  });
});
