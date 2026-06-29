/**
 * @file Unit tests for src/core/listStore.js — once-only depletion, alias resolution,
 * and artist/NSFW gating, driven by a tiny in-memory loader.
 *
 * RNG landmine: index selection uses `_.random`. Single-entry lists make the pick
 * deterministic; multi-entry assertions use set/again invariants.
 */
import { describe, it, expect } from "vitest";
import { createListStore } from "../../src/core/listStore.js";

const loaderFor = (lists) => ({
  readListLines: (name) => (name in lists ? lists[name].slice() : null),
  listNames: () => Object.keys(lists),
});

const base = {
  artistFilename: "artist",
  keywordsFilename: "keyword",
  includeArtist: true,
  includeAdult: false,
  listEntriesUsedOnce: true,
};

describe("listStore.pull — basic", () => {
  it("returns the single entry of a one-item list", () => {
    const s = createListStore(loaderFor({ color: ["red"] }));
    expect(s.pull(base, "color")).toBe("red");
  });

  it("returns '' for a missing list", () => {
    const s = createListStore(loaderFor({}));
    expect(s.pull(base, "nope")).toBe("");
  });
});

describe("listStore.pull — depletion", () => {
  it("depletes once-used entries, then reloads when empty", () => {
    const s = createListStore(loaderFor({ pair: ["a", "b"] }));
    const first = s.pull(base, "pair");
    const second = s.pull(base, "pair");
    expect([first, second].sort()).toEqual(["a", "b"]); // both distinct within the prompt
    // Third pull triggers a reload (the list refilled), so it's a valid entry again.
    expect(["a", "b"]).toContain(s.pull(base, "pair"));
  });

  it("does NOT deplete when listEntriesUsedOnce is false", () => {
    const s = createListStore(loaderFor({ one: ["x"] }));
    const settings = { ...base, listEntriesUsedOnce: false };
    expect(s.pull(settings, "one")).toBe("x");
    expect(s.pull(settings, "one")).toBe("x"); // still there
  });

  it("reset() clears depletion so a fresh prompt draws the full set", () => {
    const s = createListStore(loaderFor({ pair: ["a", "b"] }));
    s.pull(base, "pair");
    s.pull(base, "pair");
    s.reset();
    const after = [s.pull(base, "pair"), s.pull(base, "pair")].sort();
    expect(after).toEqual(["a", "b"]);
  });
});

describe("listStore.pull — aliases", () => {
  it("resolves the keyword alias to keywordsFilename", () => {
    const s = createListStore(loaderFor({ keyword: ["kw"] }));
    expect(s.pull(base, "keyword")).toBe("kw");
  });

  it("with keywordsFilename 'false', draws a random NON-artist list", () => {
    const s = createListStore(loaderFor({ a: ["x"], b: ["y"], artist: ["nope"] }));
    const out = s.pull({ ...base, keywordsFilename: "false" }, "keyword");
    expect(["x", "y"]).toContain(out); // never the artist list
  });
});

describe("listStore.pull — gating", () => {
  it("returns '' for an artist list when includeArtist is off", () => {
    const s = createListStore(loaderFor({ artist: ["picasso"] }));
    expect(s.pull({ ...base, includeArtist: false }, "artist")).toBe("");
  });

  it("returns '' for an nsfw-token list when includeAdult is off, the entry when on", () => {
    const s = createListStore(loaderFor({ "clothes-nsfw": ["lewd"] }));
    expect(s.pull({ ...base, includeAdult: false }, "clothes-nsfw")).toBe("");
    expect(s.pull({ ...base, includeAdult: true }, "clothes-nsfw")).toBe("lewd");
  });
});
