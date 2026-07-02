/**
 * @file Bug-regression suite.
 *
 * Each test here locks in the FIX for a specific defect (or a documented landmine
 * that would re-break easily) so it can never silently regress. When you fix a new
 * bug, add a `it("regression: …")` here that fails on the old behaviour and passes on
 * the fix, with a one-line note on the original symptom.
 */
import { describe, it, expect } from "vitest";
import { classifyRemoval, isNsfw } from "../../src/contentSafety.js";
import { hasNsfwToken } from "../../src/gatedLists.js";
import { resolveName } from "../../src/listManifest.js";
import { createEngine } from "../../src/core/engine.js";
import { makeFakeLoader } from "../helpers/fakeLoader.js";

const baseSettings = {
  artistFilename: "artist",
  keywordEmphasis: false,
  emphasisChance: 0,
  mode: "StableDiffusion",
  includeArtist: true,
  includeAdult: false,
  listEntriesUsedOnce: true,
  autoAddFx: false,
  autoAddArtists: false,
};

describe("regression: content-safety whole-word matching (Scunthorpe problem)", () => {
  // Symptom: substring matching flagged innocent words containing a slur fragment.
  it("never flags innocent words that merely contain a banned fragment", () => {
    expect(classifyRemoval("cockpit")).toBeNull();
    expect(classifyRemoval("scunthorpe")).toBeNull();
    expect(classifyRemoval("assassin")).toBeNull();
    expect(isNsfw("cockpit")).toBe(false);
  });
});

describe("regression: nsfw gating must be a whole token, not a substring", () => {
  // Symptom: `hasNsfwToken("nsfwish")` returned true, gating innocent names.
  it("does not gate names where 'nsfw' is part of a larger word", () => {
    expect(hasNsfwToken("nsfwish")).toBe(false);
    expect(hasNsfwToken("answersfw")).toBe(false);
    expect(hasNsfwToken("clothes-nsfw")).toBe(true);
  });
});

describe("regression: reserved 'keyword' wildcard must not resolve to a real list", () => {
  // Symptom: {keyword} suffix-matched danbooru/d/keyword instead of the wildcard.
  it("keeps 'keyword' as the wildcard even when a d/keyword list exists", () => {
    expect(resolveName("keyword", ["danbooru/d/keyword", "color"])).toBe("keyword");
  });
});

describe("regression: list stage must not swallow dynamic-prompt tokens", () => {
  // Symptom: the {name} list stage mis-pulled a list named "#scene" for {#scene}.
  it("leaves a stray {#name} token intact for the dynamic-prompt stage", () => {
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    const out = engine.expand(
      "{#scene}",
      { ...baseSettings, promptModules: ["list", "cleanup"] },
      {},
      {},
    );
    expect(out).toBe("{#scene}");
  });
});

describe("regression: NSFW generators are gated off unless adult mode is on", () => {
  // Symptom: an nsfw-tokened generator could leak when includeAdult was false.
  it("resolves an nsfw generator to empty when adult is off, and runs it when on", () => {
    const loader = makeFakeLoader({
      dynamicPrompts: { "nude-nsfw": { default: () => "explicit" } },
    });
    const engine = createEngine(loader);
    const modules = ["dynamic-prompt", "cleanup"];
    expect(
      engine.expand(
        "{#nude-nsfw}",
        { ...baseSettings, includeAdult: false, promptModules: modules },
        {},
        {},
      ),
    ).toBe("");
    expect(
      engine.expand(
        "{#nude-nsfw}",
        { ...baseSettings, includeAdult: true, promptModules: modules },
        {},
        {},
      ),
    ).toBe("explicit");
  });
});

describe("regression: cleanup strips the comma after AND", () => {
  // Symptom: "AND," leaked into prompts and broke SD's AND compositing.
  it("rewrites 'AND,' to 'AND'", async () => {
    const { default: cleanup } = await import("../../src/core/stages/cleanup.js");
    expect(cleanup("a AND, b")).toBe("a AND b");
  });
});
