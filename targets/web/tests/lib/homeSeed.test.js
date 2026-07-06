/**
 * @file Unit tests for the pure roll-seed helpers (lib/home/seed.js): the random-vs-pinned decision,
 * per-prompt forking, and the display write-back guard.
 */
import { describe, it, expect } from "vitest";
import { pickRollSeed, forkRollSeed, shouldReflectSeed } from "../../frontend/lib/home/seed.js";

describe("pickRollSeed", () => {
  const mint = () => "MINTED";

  it("pins to promptSeed (trimmed) when Random is off and a seed is set — never mints", () => {
    let called = 0;
    const seed = pickRollSeed(
      { randomSeed: false, promptSeed: "  my seed 42  " },
      () => (called++, "MINTED"),
    );
    expect(seed).toBe("my seed 42");
    expect(called).toBe(0);
  });

  it("mints a fresh seed when Random is on (explicit true)", () => {
    expect(pickRollSeed({ randomSeed: true, promptSeed: "ignored" }, mint)).toBe("MINTED");
  });

  it("mints when Random is on by default (randomSeed undefined)", () => {
    expect(pickRollSeed({ promptSeed: "ignored" }, mint)).toBe("MINTED");
  });

  it("mints when pinned but the seed box is blank or whitespace", () => {
    expect(pickRollSeed({ randomSeed: false, promptSeed: "" }, mint)).toBe("MINTED");
    expect(pickRollSeed({ randomSeed: false, promptSeed: "   " }, mint)).toBe("MINTED");
    expect(pickRollSeed({ randomSeed: false }, mint)).toBe("MINTED");
  });

  it("uses the real seed generator by default and returns a non-empty string", () => {
    const a = pickRollSeed({ randomSeed: true });
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("forkRollSeed", () => {
  it("appends the index so each prompt gets a distinct sub-seed", () => {
    expect(forkRollSeed("base", 0)).toBe("base#0");
    expect(forkRollSeed("base", 3)).toBe("base#3");
    expect(forkRollSeed("base", 0)).not.toBe(forkRollSeed("base", 1));
  });
});

describe("shouldReflectSeed", () => {
  it("is true only when the roll seed differs from the stored promptSeed", () => {
    expect(shouldReflectSeed({ promptSeed: "old" }, "new")).toBe(true);
    expect(shouldReflectSeed({ promptSeed: "same" }, "same")).toBe(false);
    expect(shouldReflectSeed({ promptSeed: "" }, "minted")).toBe(true);
  });
});
