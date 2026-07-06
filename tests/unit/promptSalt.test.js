/**
 * @file Unit tests for the prompt-salt pipeline stage
 * (src/core/stages/prompt-salt.js) — still imported by the active core engine.
 */
import { describe, it, expect } from "vitest";
import promptSalt from "../../engine/core/stages/prompt-salt.js";

describe("prompt-salt stage", () => {
  it("does nothing when salt is off and no token is present", () => {
    const settings = { promptSalt: false, promptSaltStart: -1 };
    const img = {};
    expect(promptSalt("a cat", settings, img)).toBe("a cat");
    expect(img.usedSalt).toBeUndefined();
  });

  it("resolves {salt} to an incrementing seed and records the bare number", () => {
    const settings = { promptSalt: false, promptSaltStart: 5 };
    const img = {};
    const out = promptSalt("{salt}", settings, img);
    expect(out).toBe("[5]");
    expect(img.usedSalt).toBe("5");
    expect(settings.promptSaltStart).toBe(6); // advanced for the next prompt
  });

  it("auto-appends a salt when promptSalt is enabled and none is present", () => {
    const settings = { promptSalt: true, promptSaltStart: 42 };
    const img = {};
    expect(promptSalt("sunset", settings, img)).toBe("sunset [42]");
    expect(img.usedSalt).toBe("42");
    expect(settings.promptSaltStart).toBe(43);
  });

  it("rewrites an existing [n] literal to the current incrementing seed", () => {
    const settings = { promptSalt: false, promptSaltStart: 7 };
    const img = {};
    expect(promptSalt("forest [123]", settings, img)).toBe("forest [7]");
    expect(img.usedSalt).toBe("7");
  });

  it("uses a random 10-digit salt when promptSaltStart is negative", () => {
    // getRndSalt() uses lodash _.random (RNG not stubbable) — assert the shape.
    const settings = { promptSalt: true, promptSaltStart: -1 };
    const img = {};
    const out = promptSalt("x", settings, img);
    expect(out).toMatch(/^x \[\d{10}\]$/);
    expect(img.usedSalt).toMatch(/^\d{10}$/);
    expect(settings.promptSaltStart).toBe(-1); // not advanced in random mode
  });
});
