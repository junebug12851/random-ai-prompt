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
  it("threads {#name iNN%} into a .dpl generator's conditions and $intensity-word keyword", () => {
    // Plain (always-on) conditioned lines keep this deterministic (no probabilistic bullet gates).
    const engine = createEngine(
      makeFakeLoader({ dpl: { mood: "base $intensity-word\n[i<10%] calm\n[i>80%] intense" } }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#mood i5%}", settings, {}, {})).toBe("base speck, calm");
    expect(engine.expand("{#mood i95%}", settings, {}, {})).toBe("base gargantuan, intense");
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
    expect(engine.expand("{#probe i30%}", settings, {}, {})).toBe("30");
    expect(engine.expand("{#probe}", settings, {}, {})).toBe("50");
    expect(engine.expand("{#probe i0%}", settings, {}, {})).toBe("1"); // 0 → 1
  });
});

describe("engine — focus dial", () => {
  it("threads {#name fNN%} into a .dpl generator's [f<NN%] conditions and $focus-word keyword", () => {
    const engine = createEngine(
      makeFakeLoader({
        dpl: { scene: "core $focus-word\n[f<30%] distant city\n[f>70%] strictly essential" },
      }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    // Low focus admits the fluff "distant city"; high focus drops it and keeps only essentials.
    expect(engine.expand("{#scene f10%}", settings, {}, {})).toBe("core lenient, distant city");
    expect(engine.expand("{#scene f95%}", settings, {}, {})).toBe(
      "core isolated, strictly essential",
    );
    expect(engine.expand("{#scene}", settings, {}, {})).toBe("core normal");
  });

  it("passes focus to a JS generator as the 5th argument, alongside intensity", () => {
    const engine = createEngine(
      makeFakeLoader({
        dynamicPrompts: {
          probe: { default: (_s, _i, _u, intensity, focus) => `${intensity}/${focus}` },
        },
      }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#probe f80%}", settings, {}, {})).toBe("50/80");
    expect(engine.expand("{#probe}", settings, {}, {})).toBe("50/50");
    expect(engine.expand("{#probe i20% f80%}", settings, {}, {})).toBe("20/80");
  });
});

describe("engine — global layer auto-merge (dedup)", () => {
  it("renders a singular generator once when a generator imports it repeatedly", () => {
    const engine = createEngine(
      makeFakeLoader({ dpl: { weather: "rain", scene: "field, {#weather}, {#weather}" } }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    // scene imports weather twice; the second nested import dedups away.
    expect(engine.expand("{#scene}", settings, {}, {})).toBe("field, rain");
  });

  it("always honors user-typed duplicates (top-level, not imports)", () => {
    const engine = createEngine(makeFakeLoader({ dpl: { weather: "rain" } }));
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#weather}, {#weather}", settings, {}, {})).toBe("rain, rain");
  });

  it("a stacking generator is exempt and renders on every import", () => {
    const engine = createEngine(
      makeFakeLoader({
        dpl: { tint: "---\nstacking: true\n---\nblue", scene: "wall, {#tint}, {#tint}" },
      }),
    );
    const settings = { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] };
    expect(engine.expand("{#scene}", settings, {}, {})).toBe("wall, blue, blue");
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
