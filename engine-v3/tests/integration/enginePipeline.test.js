/**
 * @file Integration tests for the framework-agnostic prompt engine
 * (src/core/engine.js) driven by an in-memory fake loader, so the whole
 * stage pipeline (dynamic-prompt -> list -> cleanup) is exercised
 * end-to-end without the filesystem.
 */
import { describe, it, expect } from "vitest";
import { createEngine } from "../../src/core/engine.js";
import { makeFakeLoader } from "../helpers/fakeLoader.js";

const baseSettings = {
  artistFilename: "artist",
  keywordsFilename: "keyword",
  keywordEmphasis: false,
  emphasisChance: 0,
  mode: "StableDiffusion",
  includeArtist: true,
  includeAdult: false,
  listEntriesUsedOnce: true,
  autoAddFx: false,
  autoAddArtists: false,
};

describe("engine — list stage", () => {
  it("resolves a {list} token to a list entry", () => {
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    const out = engine.expand(
      "{color}",
      { ...baseSettings, promptModules: ["list", "cleanup"] },
      {},
      {},
    );
    expect(out).toBe("red");
  });

  it("depletes once-used entries within a single prompt", () => {
    const engine = createEngine(makeFakeLoader({ lists: { pair: ["a", "b"] } }));
    const out = engine.expand(
      "{pair} {pair}",
      { ...baseSettings, promptModules: ["list", "cleanup"] },
      {},
      {},
    );
    expect(out.split(" ").sort()).toEqual(["a", "b"]);
  });
});

describe("engine — dynamic-prompt stage", () => {
  it("runs a JS generator module for {#name}", () => {
    const engine = createEngine(
      makeFakeLoader({ dynamicPrompts: { greet: { default: () => "hi there" } } }),
    );
    const out = engine.expand(
      "{#greet}",
      { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] },
      {},
      {},
    );
    expect(out).toBe("hi there");
  });

  it("compiles and runs a .dpl generator for {#name}", () => {
    const engine = createEngine(makeFakeLoader({ dpl: { greet: "hi from dpl" } }));
    const out = engine.expand(
      "{#greet}",
      { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] },
      {},
      {},
    );
    expect(out).toBe("hi from dpl");
  });
});

describe("engine — full pipeline", () => {
  it("runs dynamic-prompt -> list -> cleanup in order", () => {
    const engine = createEngine(
      makeFakeLoader({
        lists: { color: ["red"] },
        dynamicPrompts: { greet: { default: () => "hi there" } },
      }),
    );
    const settings = {
      ...baseSettings,
      promptModules: ["dynamic-prompt", "list", "cleanup"],
    };
    const out = engine.expand("{#greet}, {color}", settings, {}, {});
    expect(out).toBe("hi there, red");
  });

  it("generateMany returns the requested number of prompts", () => {
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    const prompts = engine.generateMany({ ...baseSettings, prompt: "{color}", promptCount: 3 });
    expect(prompts).toHaveLength(3);
    prompts.forEach((p) => expect(p).toBe("red"));
  });
});

describe("engine — intensity dial", () => {
  it("threads {#name NN%} into a .dpl generator's conditions and {intensity} keyword", () => {
    // Plain (always-on) conditioned lines keep this deterministic (no probabilistic bullet gates).
    const engine = createEngine(
      makeFakeLoader({ dpl: { mood: "base {intensity}\n[<10%] calm\n[>80%] intense" } }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#mood 5%}", settings, {}, {})).toBe("base tiny, calm");
    expect(engine.expand("{#mood 95%}", settings, {}, {})).toBe("base massive, intense");
    // Unspecified → the 50% default: neither edge condition fires.
    expect(engine.expand("{#mood}", settings, {}, {})).toBe("base normal");
  });

  it("passes the intensity to a JS generator as the 4th argument (default 50)", () => {
    const engine = createEngine(
      makeFakeLoader({
        dynamicPrompts: { probe: { default: (_s, _i, _u, intensity) => String(intensity) } },
      }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#probe 30%}", settings, {}, {})).toBe("30");
    expect(engine.expand("{#probe}", settings, {}, {})).toBe("50");
    expect(engine.expand("{#probe 0%}", settings, {}, {})).toBe("1"); // 0 → 1
  });
});

describe("engine — auto-append (fx / artists)", () => {
  it("resolves nested {#…} inside an auto-appended {#fx} (no literal token leaks)", () => {
    const engine = createEngine(makeFakeLoader({ dpl: { fx: "boom {#spark}", spark: "zap" } }));
    const settings = {
      ...baseSettings,
      autoAddFx: true,
      autoAddArtists: false,
      promptModules: ["dynamic-prompt", "cleanup"],
    };
    const out = engine.expand("base", settings, {}, {});
    expect(out).toContain("zap"); // the nested token resolved
    expect(out).not.toContain("{#"); // nothing left dangling
  });
});
