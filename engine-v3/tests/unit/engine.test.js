/**
 * @file Unit tests for src/core/engine.js public API edges not covered by the
 * integration suite: generate() default-prompt fallback, generateMany count
 * clamping, unknown-stage skip, and carriage-return stripping.
 */
import { describe, it, expect } from "vitest";
import { createEngine } from "../../src/core/engine.js";
import { makeFakeLoader } from "../helpers/fakeLoader.js";
import { withSeed } from "../helpers/seededRandom.js";

const pm = (...mods) => ({ promptModules: mods, autoAddFx: false, autoAddArtists: false });

describe("engine.generate", () => {
  it("falls back to the default {#random-words} prompt from settings", () => {
    const engine = createEngine(
      makeFakeLoader({ dynamicPrompts: { "random-words": { default: () => "hello" } } }),
    );
    expect(engine.generate(pm("dynamic-prompt", "cleanup"))).toContain("hello");
  });

  it("uses an explicit prompt override", () => {
    // Emphasis is left ON (the default) and the whole engine is seeded, so the output is
    // deterministic *with* the real keyword decoration applied — the override still resolves the
    // `{color}` list to its single "red" entry, possibly wrapped by the (now seedable) emphasis pass.
    const engine = createEngine(makeFakeLoader({ lists: { color: ["red"] } }));
    const out = withSeed(7, () => engine.generate({ ...pm("list", "cleanup"), prompt: "{color}" }));
    expect(out).toContain("red");
  });

  it("is fully reproducible under a fixed seed (RNG is seedable end-to-end)", () => {
    // Guards the seedable-RNG contract: every random pass (list pull, emphasis, editing,
    // alternating) draws from the live Math.random, so the same seed yields byte-identical output.
    const opts = { ...pm("list", "cleanup"), prompt: "{color}" };
    const make = () => createEngine(makeFakeLoader({ lists: { color: ["crimson", "scarlet"] } }));
    const a = withSeed(42, () => make().generate(opts));
    const b = withSeed(42, () => make().generate(opts));
    expect(a).toBe(b);
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
