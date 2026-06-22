/**
 * @file Integration tests for the framework-agnostic prompt engine
 * (src/core/engine.js) driven by an in-memory fake loader, so the whole
 * stage pipeline (expansion -> dynamic-prompt -> list -> cleanup) is exercised
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
    const out = engine.expand("{color}", { ...baseSettings, promptModules: ["list", "cleanup"] }, {}, {});
    expect(out).toBe("red");
  });

  it("depletes once-used entries within a single prompt", () => {
    const engine = createEngine(makeFakeLoader({ lists: { pair: ["a", "b"] } }));
    const out = engine.expand("{pair} {pair}", { ...baseSettings, promptModules: ["list", "cleanup"] }, {}, {});
    expect(out.split(" ").sort()).toEqual(["a", "b"]);
  });
});

describe("engine — expansion stage", () => {
  it("splices a <name> expansion's text", () => {
    const engine = createEngine(makeFakeLoader({ expansions: { greeting: "hello there" } }));
    const out = engine.expand("<greeting>", { ...baseSettings, promptModules: ["expansion", "cleanup"] }, {}, {});
    expect(out).toBe("hello there");
  });
});

describe("engine — dynamic-prompt stage", () => {
  it("runs a JS generator module for {#name}", () => {
    const engine = createEngine(
      makeFakeLoader({ dynamicPrompts: { greet: { default: () => "hi there" } } }),
    );
    const out = engine.expand("{#greet}", { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] }, {}, {});
    expect(out).toBe("hi there");
  });

  it("compiles and runs a .dpl generator for {#name}", () => {
    const engine = createEngine(makeFakeLoader({ dpl: { greet: "hi from dpl" } }));
    const out = engine.expand("{#greet}", { ...baseSettings, promptModules: ["dynamic-prompt", "cleanup"] }, {}, {});
    expect(out).toBe("hi from dpl");
  });
});

describe("engine — full pipeline", () => {
  it("runs expansion -> dynamic-prompt -> list -> cleanup in order", () => {
    const engine = createEngine(
      makeFakeLoader({
        lists: { color: ["red"] },
        expansions: { greeting: "hello" },
        dynamicPrompts: { greet: { default: () => "hi there" } },
      }),
    );
    const settings = { ...baseSettings, promptModules: ["expansion", "dynamic-prompt", "list", "cleanup"] };
    const out = engine.expand("<greeting>, {#greet}, {color}", settings, {}, {});
    expect(out).toBe("hello, hi there, red");
  });

  it("generateMany returns the requested number of prompts", () => {
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    const prompts = engine.generateMany({ ...baseSettings, prompt: "{color}", promptCount: 3 });
    expect(prompts).toHaveLength(3);
    prompts.forEach((p) => expect(p).toBe("red"));
  });
});
