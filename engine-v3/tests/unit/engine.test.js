/**
 * @file Unit tests for src/core/engine.js public API edges not covered by the
 * integration suite: generate() default-prompt fallback, generateMany count
 * clamping, unknown-stage skip, and carriage-return stripping.
 */
import { describe, it, expect } from "vitest";
import { createEngine } from "../../src/core/engine.js";
import { makeFakeLoader } from "../helpers/fakeLoader.js";

// Disable the random emphasis/alternating passes so exact-output assertions are deterministic.
// (lodash's Math.random can't be stubbed — see notes/plans/testing.md — so the only reliable way
// to get a fixed string out of the `list` stage is to turn off the random keyword decoration.)
const pm = (...mods) => ({
  promptModules: mods,
  autoAddFx: false,
  autoAddArtists: false,
  keywordEmphasis: false,
  keywordAlternating: false,
});

describe("engine.generate", () => {
  it("falls back to the default {#random-words} prompt from settings", () => {
    const engine = createEngine(
      makeFakeLoader({ dynamicPrompts: { "random-words": { default: () => "hello" } } }),
    );
    expect(engine.generate(pm("dynamic-prompt", "cleanup"))).toContain("hello");
  });

  it("uses an explicit prompt override", () => {
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    expect(engine.generate({ ...pm("list", "cleanup"), prompt: "{color}" })).toBe("red");
  });
});

describe("engine.generateMany — count clamping", () => {
  const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
  const opts = { ...pm("list", "cleanup"), prompt: "{color}" };

  it("returns the requested count", () => {
    expect(engine.generateMany({ ...opts, promptCount: 3 })).toHaveLength(3);
  });
  it("clamps 0, negative, and non-numeric counts up to 1", () => {
    expect(engine.generateMany({ ...opts, promptCount: 0 })).toHaveLength(1);
    expect(engine.generateMany({ ...opts, promptCount: -5 })).toHaveLength(1);
    expect(engine.generateMany({ ...opts, promptCount: "x" })).toHaveLength(1);
  });
  it("defaults to one prompt when count is omitted", () => {
    expect(engine.generateMany(opts)).toHaveLength(1);
  });
});

describe("engine.expand — pipeline robustness", () => {
  const engine = createEngine(makeFakeLoader({}));
  it("skips an unknown stage name without throwing", () => {
    expect(engine.expand("hi", { promptModules: ["nope", "cleanup"] }, {}, {})).toBe("hi");
  });
  it("strips stray carriage returns after the pipeline", () => {
    expect(engine.expand("a\r\nb", { promptModules: [] }, {}, {})).toBe("a\nb");
  });
});
