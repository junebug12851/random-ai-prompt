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

describe("engine seeding (settings.seed)", () => {
  const make = () =>
    createEngine(
      makeFakeLoader({ lists: { color: ["crimson", "scarlet", "ruby", "cherry", "rose"] } }),
    );
  const opts = { ...pm("list", "cleanup"), prompt: "{color} {color} {color}" };

  it("generate is reproducible for the same seed and differs across seeds", () => {
    const a = make().generate({ ...opts, seed: "s1" });
    const b = make().generate({ ...opts, seed: "s1" });
    expect(a).toBe(b);
    // A different seed generally reorders the picks; try a few to avoid a coincidental match.
    const differs = ["s2", "s3", "s4"].some((seed) => make().generate({ ...opts, seed }) !== a);
    expect(differs).toBe(true);
  });

  it("generateWithSeed reports a seed that reproduces the prompt", () => {
    const { prompt, seed } = make().generateWithSeed(opts);
    expect(typeof seed).toBe("string");
    expect(make().generate({ ...opts, seed })).toBe(prompt);
  });

  it("generateMany is a reproducible batch under a seed", () => {
    const a = make().generateMany({ ...opts, seed: "batch", promptCount: 5 });
    const b = make().generateMany({ ...opts, seed: "batch", promptCount: 5 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });

  it("generateManyAsync matches generateMany for the same seed", async () => {
    const sync = make().generateMany({ ...opts, seed: "z", promptCount: 4 });
    const asyncOut = await make().generateManyAsync({ ...opts, seed: "z", promptCount: 4 });
    expect(asyncOut).toEqual(sync);
  });

  it("an unseeded generate still works (draws from Math.random)", () => {
    expect(make().generate(opts)).toMatch(/crimson|scarlet|ruby|cherry|rose/);
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
