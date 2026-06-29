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

/** Render at full intensity and an explicit focus (1..100). */
const renderAtF = (src, focus, settings = {}) =>
  compileDpl(src, { resolveJs: () => "" }).default(settings, {}, {}, 100, focus);

/** Render at an explicit intensity AND focus. */
const renderAtIF = (src, intensity, focus, settings = {}) =>
  compileDpl(src, { resolveJs: () => "" }).default(settings, {}, {}, intensity, focus);

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

describe("DPL: dial conditions (intensity / focus)", () => {
  it("renders an [i<10%] line only when intensity is below the threshold", () => {
    const src = "Start\n===\nbase\n[i<10%] - grass";
    // The bracket sits before the dash; the bullet is forced on with withRandom(0).
    expect(withRandom(0, () => renderAt(src, 5))).toBe("base, grass");
    expect(withRandom(0, () => renderAt(src, 50))).toBe("base");
  });

  it("renders an [f<30%] line by the focus dial (low focus admits fluff)", () => {
    const src = "Start\n===\ncore\n[f<30%] distant city";
    expect(renderAtF(src, 10)).toBe("core, distant city");
    expect(renderAtF(src, 90)).toBe("core");
  });

  it("supports the comparison operators (>, >=, =, !=)", () => {
    expect(withRandom(0, () => renderAt("Start\n===\n- [i>50%] x", 80))).toBe("x");
    expect(withRandom(0, () => renderAt("Start\n===\n- [i>50%] x", 50))).toBe("");
    expect(withRandom(0, () => renderAt("Start\n===\n- [i=50%] x", 50))).toBe("x");
    expect(withRandom(0, () => renderAt("Start\n===\n- [i!=50%] x", 50))).toBe("");
  });

  it("stacks a weight with an i- and f-condition (pipe or space), in any order", () => {
    const src = "Start\n===\n[1000] late\n- [10 i<20% f>40%] early";
    // intensity 10 (<20 ✓) AND focus 50 (>40 ✓) → early sorts first by weight.
    expect(withRandom(0, () => renderAtIF(src, 10, 50))).toBe("early, late");
    // focus 30 (>40 ✗) → the weighted line drops out even though intensity still passes.
    expect(withRandom(0, () => renderAtIF(src, 10, 30))).toBe("late");
  });

  it("leaves an unprefixed [<10%] as payload — the i/f prefix is mandatory", () => {
    // No prefix → not a condition; the bracket text passes through literally (a plain, always-on line).
    expect(renderAt("Start\n===\nbase\n[<10%] grass", 5)).toBe("base, [<10%] grass");
    expect(renderAt("Start\n===\nbase\n[<10%] grass", 50)).toBe("base, [<10%] grass");
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

describe("DPL: dial keyword tokens ($intensity / $focus)", () => {
  it("expands $intensity-word from the 100-step scale; $intensity is the percent", () => {
    // 100-word scale (1..100): 20→ultra-tiny, 50→normal, 85→immense.
    expect(renderAt("Start\n===\n$intensity-word amount of grass", 20)).toBe(
      "ultra-tiny amount of grass",
    );
    expect(renderAt("Start\n===\n$intensity-word amount of grass", 50)).toBe(
      "normal amount of grass",
    );
    expect(renderAt("Start\n===\n$intensity-word amount of grass", 85)).toBe(
      "immense amount of grass",
    );
    expect(renderAt("Start\n===\nlevel $intensity", 50)).toBe("level 50%");
  });

  it("expands $focus-word from the 100-step scale; $focus is the percent", () => {
    // Focus scale (broad→pure): 10→kitchen-sink, 50→balanced, 95→purified.
    expect(renderAtF("Start\n===\n$focus-word scene", 10)).toBe("kitchen-sink scene");
    expect(renderAtF("Start\n===\n$focus-word scene", 50)).toBe("balanced scene");
    expect(renderAtF("Start\n===\n$focus-word scene", 95)).toBe("purified scene");
    expect(renderAtF("Start\n===\nf $focus", 80)).toBe("f 80%");
  });

  it("applies a relative ±NN% modifier to a dial keyword", () => {
    // 50 × 1.5 = 75 → "crowded"; 50 × 0.5 = 25 → "itty-bitty".
    expect(renderAt("Start\n===\n$intensity-word +50%", 50)).toBe("crowded");
    expect(renderAt("Start\n===\n$intensity-word -50%", 50)).toBe("itty-bitty");
    expect(renderAt("Start\n===\n$intensity +50%", 50)).toBe("75%");
  });

  it("normalizes a prefixed relative/absolute {#name …} ref to absolute, prefixed percents", () => {
    expect(renderAt("Start\n===\n{#weather i+50%}", 50)).toBe("{#weather i75%}");
    expect(renderAt("Start\n===\n{#weather i-40%}", 50)).toBe("{#weather i30%}");
    expect(renderAt("Start\n===\n{#weather i80%}", 50)).toBe("{#weather i80%}");
    // Focus, relative and absolute; and both dials together.
    expect(renderAtF("Start\n===\n{#weather f+50%}", 50)).toBe("{#weather f75%}");
    expect(renderAt("Start\n===\n{#weather i20% f80%}", 50)).toBe("{#weather i20% f80%}");
    // Unprefixed args are NOT dial syntax → the ref is left untouched.
    expect(renderAt("Start\n===\n{#weather 80%}", 50)).toBe("{#weather 80%}");
  });

  it("clamps a dial (0 → 1, >100 → 100), rendered as a percent", () => {
    expect(renderAt("Start\n===\n$intensity", 0)).toBe("1%");
    expect(renderAt("Start\n===\n$intensity", 250)).toBe("100%");
  });
});
