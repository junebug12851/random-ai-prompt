/**
 * @file Bug-regression suite.
 *
 * Each test here locks in the FIX for a specific defect (or a documented landmine
 * that would re-break easily) so it can never silently regress. When you fix a new
 * bug, add a `it("regression: …")` here that fails on the old behaviour and passes on
 * the fix, with a one-line note on the original symptom.
 */
import { describe, it, expect } from "vitest";
import { classifyRemoval, isNsfw } from "../../engine/contentSafety.js";
import { hasNsfwToken } from "../../engine/gatedLists.js";
import { resolveName } from "../../engine/listManifest.js";
import { createEngine } from "../../engine/core/engine.js";
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
    const { default: cleanup } = await import("../../engine/core/stages/cleanup.js");
    expect(cleanup("a AND, b")).toBe("a AND b");
  });
});

describe("regression: prompt seeding is explicit — no seed rerolls, any integer seed pins", () => {
  // Symptom: after the deterministic-engine overhaul, the GUI's default image seed of -1 leaked in as
  // an explicit prompt seed, so the engine pinned EVERY reroll (and the live preview) to one prompt.
  // The fix separates the two seeds at the GUI boundary and drives random-vs-pinned from an explicit
  // toggle — so the engine itself uses NO magic seed values. This locks in that contract: when a seed
  // is given it is honoured verbatim (including 0 and negatives), and when none is given each call
  // rerolls fresh. The image seed must never reach the engine (verified in the GUI facade suite).
  const make = () =>
    createEngine(
      makeFakeLoader({ lists: { color: ["crimson", "scarlet", "ruby", "cherry", "rose"] } }),
    );
  const opts = {
    ...baseSettings,
    promptModules: ["list", "cleanup"],
    prompt: "{color} {color} {color}",
  };
  const distinct = (seed) =>
    new Set(Array.from({ length: 40 }, () => make().generate({ ...opts, seed }))).size;

  it("rerolls fresh results when NO seed is given", () => {
    expect(distinct(undefined)).toBeGreaterThan(1);
    expect(distinct("")).toBeGreaterThan(1);
  });

  it("honours any integer seed verbatim — 0, -1 and other negatives all pin (no magic values)", () => {
    for (const seed of [0, -1, -42, 12345]) {
      const a = make().generate({ ...opts, seed });
      const b = make().generate({ ...opts, seed });
      expect(a).toBe(b); // deterministic for a fixed seed
    }
    // Different seeds generally differ (guards against a value being silently ignored/aliased).
    const outs = [-1, -42, 7, 12345, 99999].map((seed) => make().generate({ ...opts, seed }));
    expect(new Set(outs).size).toBeGreaterThan(1);
  });
});

describe("regression: a REUSED engine reproduces a seeded prompt (no leftover list-stage state)", () => {
  // Symptom: the SPA engine is a module singleton, so it is reused across every roll. The list stage
  // held a func-rotation bag (promptFuncsTmp) as closure state that was NOT reset per generation, so
  // residue from a prior roll changed the next roll's shuffle/pick order — and a "pinned" seed failed
  // to reproduce as soon as emphasis fired. (Earlier tests missed it by building a fresh engine per
  // call, which always started with an empty bag.) This test reuses ONE engine, like the app does.
  const engine = createEngine(
    makeFakeLoader({
      lists: { color: ["crimson", "scarlet", "ruby", "cherry", "rose", "amber", "teal", "indigo"] },
    }),
  );
  // Emphasis ALWAYS fires (emphasisChance 1) so the rotation bag is exercised every keyword.
  const opts = {
    ...baseSettings,
    promptModules: ["list", "emphasis", "cleanup"],
    prompt: "{color} {color} {color} {color}",
    keywordEmphasis: true,
    emphasisChance: 1,
    emphasisLevelChance: 0.5,
    emphasisMaxLevels: 3,
    deEmphasisChance: 0.25,
    keywordEditing: true,
    keywordEditingMin: 2,
    keywordEditingMax: 4,
    keywordAlternating: true,
    keywordAlternatingMaxLevels: 2,
  };

  it("reproduces the same seed even after prior rolls left residue in the reused engine", () => {
    // Warm the engine with unseeded rolls so the leaky bag is mid-rotation.
    for (let i = 0; i < 5; i++) engine.generate({ ...opts });
    const a = engine.generate({ ...opts, seed: "fixed-seed" });
    // Interleave more unseeded rolls between the two pinned generations.
    for (let i = 0; i < 3; i++) engine.generate({ ...opts });
    const b = engine.generate({ ...opts, seed: "fixed-seed" });
    expect(a).toBe(b);
  });
});
