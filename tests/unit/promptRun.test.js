/**
 * @file Unit tests for the shared, engine-owned prompt-run helpers (`engine/promptRun.js`) — the
 * seed/reroll rules and the `createPromptRun` factory, over a fake engine so the pure shaping logic is
 * covered independently of a real engine boot.
 */
import { describe, it, expect, vi } from "vitest";
import { seedFor, forEngine, createPromptRun } from "../../engine/promptRun.js";

describe("seedFor", () => {
  it("an explicit seed always wins", () => {
    expect(seedFor({ randomSeed: true }, 7)).toBe("7");
    expect(seedFor({ randomSeed: false, promptSeed: 3 }, 9)).toBe("9");
  });

  it("pins promptSeed (any value) when randomSeed is off", () => {
    expect(seedFor({ randomSeed: false, promptSeed: 0 })).toBe("0");
    expect(seedFor({ randomSeed: false, promptSeed: "abc" })).toBe("abc");
  });

  it("is undefined for a random roll or a blank pin", () => {
    expect(seedFor({ randomSeed: true })).toBeUndefined();
    expect(seedFor({ randomSeed: false, promptSeed: "   " })).toBeUndefined();
    expect(seedFor({ randomSeed: false })).toBeUndefined();
  });
});

describe("forEngine", () => {
  it("drops the image seed and resolves the engine seed", () => {
    const out = forEngine({ seed: -1, randomSeed: false, promptSeed: 5, foo: 1 });
    expect(out.seed).toBe("5");
    expect(out.foo).toBe(1);
  });

  it("omits the seed entirely for a random roll", () => {
    const out = forEngine({ seed: -1, randomSeed: true });
    expect(out).not.toHaveProperty("seed");
  });
});

function makeEngine() {
  const calls = [];
  return {
    calls,
    generate(s) {
      calls.push(s);
      return `P:${s.prompt ?? ""}:${s.seed ?? "rand"}`;
    },
    generateMany(s) {
      calls.push(s);
      return ["a", "b"];
    },
  };
}

describe("createPromptRun", () => {
  it("generatePrompt shapes settings and calls the active-settings hook", () => {
    const engine = makeEngine();
    const setActiveSettings = vi.fn();
    const run = createPromptRun(engine, { setActiveSettings });
    const out = run.generatePrompt({ randomSeed: false, promptSeed: 5, prompt: "x" });
    expect(setActiveSettings).toHaveBeenCalledTimes(1);
    expect(out).toBe("P:x:5");
  });

  it("generatePrompts mints a base seed when none is pinned, else uses the pin", () => {
    const run = createPromptRun(makeEngine());
    const rolled = run.generatePrompts({ randomSeed: true, promptCount: 2 });
    expect(rolled.prompts).toEqual(["a", "b"]);
    expect(typeof rolled.seed).toBe("string");
    expect(rolled.seed.length).toBeGreaterThan(0);

    const pinned = run.generatePrompts({ randomSeed: false, promptSeed: "42" });
    expect(pinned.seed).toBe("42");
  });

  it("expandPrompt forces a fresh roll and never mutates the caller's settings", () => {
    const engine = makeEngine();
    const run = createPromptRun(engine);
    const settings = { randomSeed: false, promptSeed: 5 };
    run.expandPrompt("tmpl", settings);
    const last = engine.calls.at(-1);
    expect(last.prompt).toBe("tmpl");
    expect(last).not.toHaveProperty("seed"); // random forced
    expect(settings.randomSeed).toBe(false); // caller untouched
  });

  it("expandPromptSeeded honours the pinned seed", () => {
    const engine = makeEngine();
    const run = createPromptRun(engine);
    run.expandPromptSeeded("tmpl", { randomSeed: false, promptSeed: 9 });
    const last = engine.calls.at(-1);
    expect(last.prompt).toBe("tmpl");
    expect(last.seed).toBe("9");
  });

  it("works without a setActiveSettings hook", () => {
    const run = createPromptRun(makeEngine());
    expect(() => run.generatePrompt({ randomSeed: true })).not.toThrow();
  });
});
