/**
 * @file Unit tests for the DPL compiler/renderer (src/core/dpl/dpl.js) — the v3
 * "data, not code" dynamic-prompt language. Randomness is pinned so gates/choices
 * are deterministic.
 */
import { describe, it, expect } from "vitest";
import compileDpl from "../../src/core/dpl/dpl.js";

/** Run `fn` with Math.random pinned to a constant. */
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

const render = (src, settings = {}) => compileDpl(src, { resolveJs: () => "" }).default(settings, {}, {});

describe("DPL: plain text & front-matter", () => {
  it("treats plain text as an always-on layer", () => {
    expect(render("hello world")).toBe("hello world");
  });

  it("parses front-matter flags (type: full, suggestions: off)", () => {
    const mod = compileDpl("---\ntype: full\nsuggestions: off\n---\nbody text");
    expect(mod.full).toBe(true);
    expect(mod.suggestion_exclude).toBe(true);
    expect(mod.default()).toBe("body text");
  });

  it("strips ; comments", () => {
    expect(render("kept ; dropped")).toBe("kept");
  });
});

describe("DPL: weighted local ordering", () => {
  it("sorts a layer's pieces by ascending weight, ties keep document order", () => {
    const src = "Start\n===\n[20] second\n[10] first";
    expect(render(src)).toBe("first, second");
  });
});

describe("DPL: gates", () => {
  it("includes an explicit %-gated line when the roll passes, excludes when it fails", () => {
    const src = "Start\n===\nalways\n20% misty";
    expect(withRandom(0, () => render(src))).toBe("always, misty");
    expect(withRandom(0.99, () => render(src))).toBe("always");
  });

  it("defaults a bare simple-clause bullet to a 50% gate", () => {
    const src = "Start\n===\n- token here";
    expect(withRandom(0, () => render(src))).toBe("token here");
    expect(withRandom(0.99, () => render(src))).toBe("");
  });

  it("a plain (non-bullet) line is unconditional", () => {
    expect(withRandom(0.99, () => render("Start\n===\nunconditional"))).toBe("unconditional");
  });
});

describe("DPL: choice (one of / N of)", () => {
  it("picks exactly one option for 'one of'", () => {
    const src = "Start\n===\none of:\n  - a\n  - b";
    expect(withRandom(0, () => render(src))).toBe("a");
  });

  it("honors a miss chance", () => {
    const src = "Start\n===\none of (100% nothing):\n  - a\n  - b";
    expect(render(src)).toBe("");
  });
});

describe("DPL: references", () => {
  it("passes a bare +name / insert name through as a {#name} token", () => {
    expect(render("Start\n===\n+weather")).toBe("{#weather}");
    expect(render("Start\n===\ninsert weather")).toBe("{#weather}");
  });

  it("keeps an explicit #-prefixed ref as {#name}", () => {
    expect(render("Start\n===\n+#weather")).toBe("{#weather}");
  });
});

describe("DPL: repeat", () => {
  it("repeats a payload a fixed number of times", () => {
    const src = "Start\n===\nrepeat 3 times: star";
    expect(render(src)).toBe("star, star, star");
  });
});
