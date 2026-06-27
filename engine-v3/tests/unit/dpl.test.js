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

// Render at full intensity (100%) by default, so these behavioral tests assert the *authored*
// gates/counts with no intensity scaling. Intensity-specific behavior is covered in its own block.
const render = (src, settings = {}, intensity = 100) =>
  compileDpl(src, { resolveJs: () => "" }).default(settings, {}, {}, intensity);

/** Render at an explicit intensity (1..100). */
const renderAt = (src, intensity, settings = {}) =>
  compileDpl(src, { resolveJs: () => "" }).default(settings, {}, {}, intensity);

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

describe("DPL: intensity — conditions", () => {
  it("renders a [<10%] line only when intensity is below the threshold", () => {
    const src = "Start\n===\nbase\n[<10%] - grass";
    // The bracket sits before the dash; the bullet is forced on with withRandom(0).
    expect(withRandom(0, () => renderAt(src, 5))).toBe("base, grass");
    expect(withRandom(0, () => renderAt(src, 50))).toBe("base");
  });

  it("supports the comparison operators (>, >=, =, !=)", () => {
    expect(withRandom(0, () => renderAt("Start\n===\n- [>50%] x", 80))).toBe("x");
    expect(withRandom(0, () => renderAt("Start\n===\n- [>50%] x", 50))).toBe("");
    expect(withRandom(0, () => renderAt("Start\n===\n- [=50%] x", 50))).toBe("x");
    expect(withRandom(0, () => renderAt("Start\n===\n- [!=50%] x", 50))).toBe("");
  });

  it("stacks a weight with a condition (pipe or space), in either order", () => {
    const pipe = "Start\n===\n[1000] late\n- [10|<20%] early";
    const space = "Start\n===\n[1000] late\n- [10 <20%] early";
    expect(withRandom(0, () => renderAt(pipe, 10))).toBe("early, late");
    expect(withRandom(0, () => renderAt(space, 10))).toBe("early, late");
    // Condition false → the weighted line drops out.
    expect(withRandom(0, () => renderAt(pipe, 50))).toBe("late");
  });

  it("leaves non-spec brackets ([[x]], [deemph]) as payload", () => {
    expect(renderAt("Start\n===\n[[castle]]", 50)).toBe("[[castle]]");
    expect(withRandom(0, () => renderAt("Start\n===\n- [deemph] thing", 50))).toBe(
      "[deemph] thing",
    );
  });
});

describe("DPL: intensity — auto-scaling", () => {
  it("scales a probability gate by intensity", () => {
    const src = "Start\n===\n50% misty";
    // 50% gate × 100% intensity = 0.5 → a 0.4 roll passes; × 50% = 0.25 → a 0.4 roll fails.
    expect(withRandom(0.4, () => renderAt(src, 100))).toBe("misty");
    expect(withRandom(0.4, () => renderAt(src, 50))).toBe("");
  });

  it("scales a repeat count by intensity", () => {
    const src = "Start\n===\nrepeat 4 times: star";
    expect(renderAt(src, 100)).toBe("star, star, star, star");
    expect(renderAt(src, 50)).toBe("star, star"); // round(4 × 0.5) = 2
  });

  it("does not scale plain always-on lines", () => {
    expect(renderAt("Start\n===\nalways here", 1)).toBe("always here");
  });
});

describe("DPL: intensity — keyword token", () => {
  it("expands {intensity} to the magnitude word and {intensity%}/{intensity-num} to numbers", () => {
    expect(renderAt("Start\n===\n{intensity} amount of grass", 20)).toBe("tiny amount of grass");
    expect(renderAt("Start\n===\n{intensity} amount of grass", 50)).toBe("normal amount of grass");
    expect(renderAt("Start\n===\n{intensity} amount of grass", 85)).toBe("huge amount of grass");
    expect(renderAt("Start\n===\nlevel {intensity%}", 50)).toBe("level 50%");
    expect(renderAt("Start\n===\nlevel {intensity-num}", 50)).toBe("level 50");
  });

  it("applies a relative ±NN% modifier to the keyword", () => {
    // 50 × 1.5 = 75 → "large"; 50 × 0.5 = 25 → "small".
    expect(renderAt("Start\n===\n{intensity +50%}", 50)).toBe("large");
    expect(renderAt("Start\n===\n{intensity -50%}", 50)).toBe("small");
    expect(renderAt("Start\n===\n{intensity% +50%}", 50)).toBe("75%");
  });

  it("rewrites a relative {#name ±NN%} ref to an absolute percent", () => {
    expect(renderAt("Start\n===\n{#weather +50%}", 50)).toBe("{#weather 75%}");
    expect(renderAt("Start\n===\n{#weather -40%}", 50)).toBe("{#weather 30%}");
    // An absolute ref passes through unchanged.
    expect(renderAt("Start\n===\n{#weather 80%}", 50)).toBe("{#weather 80%}");
  });

  it("clamps intensity (0 → 1, >100 → 100)", () => {
    expect(renderAt("Start\n===\n{intensity-num}", 0)).toBe("1");
    expect(renderAt("Start\n===\n{intensity-num}", 250)).toBe("100");
  });
});
