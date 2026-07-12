/**
 * @file Unit tests for the pure roll-assembly helper (lib/home/buildRoll.js): base-seed selection,
 * per-prompt seed forking, prompt-count clamping, wrapper framing, and Auto-Begin/End folding.
 */
import { describe, it, expect, vi } from "vitest";
import { buildRoll } from "../../frontend/lib/home/buildRoll.js";

// A fake engine that echoes the seed it was handed and, when an autoSink is provided, contributes a
// block "Auto Begin"/"Auto End" so we can assert the folding.
const makeDeps = (over = {}) => ({
  renderWrapperPart: (part) => part, // identity: wrapper parts pass through
  generatePrompt: (s, seed) => {
    if (s.autoSink) {
      s.autoSink.begin.push("AB");
      s.autoSink.end.push("AE");
    }
    return `P(${s.prompt})[${seed}]`;
  },
  nextId: (() => {
    let n = 0;
    return () => ++n;
  })(),
  ...over,
});

const base = {
  settings: { randomSeed: false, promptSeed: "pin", promptCount: 3, useAutoSections: false },
  text: "cat",
  wrapper: { start: "", end: "" },
  mode: "StableDiffusion",
};

describe("buildRoll", () => {
  it("returns the pinned base seed and forks it per prompt (base#i)", () => {
    const { prompts, rollSeed } = buildRoll({ ...base, deps: makeDeps() });
    expect(rollSeed).toBe("pin");
    expect(prompts).toHaveLength(3);
    expect(prompts.map((p) => p.text)).toEqual([
      "P(cat)[pin#0]",
      "P(cat)[pin#1]",
      "P(cat)[pin#2]",
    ]);
  });

  it("clamps promptCount (0, negative, non-numeric) up to 1", () => {
    for (const promptCount of [0, -5, "x", undefined]) {
      const { prompts } = buildRoll({
        ...base,
        settings: { ...base.settings, promptCount },
        deps: makeDeps(),
      });
      expect(prompts).toHaveLength(1);
    }
  });

  it("coerces a fractional count to an integer, and imposes NO upper ceiling", () => {
    const len = (promptCount) =>
      buildRoll({ ...base, settings: { ...base.settings, promptCount }, deps: makeDeps() }).prompts
        .length;
    expect(len(3.9)).toBe(3); // floored, not rounded up — you can't roll half a prompt
    expect(len("7")).toBe(7); // numeric string coerced

    // Regression: this used to silently truncate to 50 (`MAX_PROMPTS`), so the app couldn't even
    // produce the 1000 prompts it documents as its supported load, and a user who asked for 200 got
    // 50 with no explanation. The documented numbers are a promise about PERFORMANCE ("this much
    // with no degradation"), NOT a cap the app enforces — past them it degrades gracefully, it never
    // refuses. Ask for it, get it.
    expect(len(999)).toBe(999);
    expect(len(1000)).toBe(1000);
    expect(len(5000)).toBe(5000); // well beyond the documented level — still honoured
  });

  it("frames the text with the wrapper start/end, dropping empty parts", () => {
    const { prompts } = buildRoll({
      ...base,
      settings: { ...base.settings, promptCount: 1 },
      wrapper: { start: "intro", end: "outro" },
      deps: makeDeps(),
    });
    expect(prompts[0].text).toBe("P(intro, cat, outro)[pin#0]");
  });

  it("folds Auto Begin/End into the prompt when auto-sections are on", () => {
    const { prompts } = buildRoll({
      ...base,
      settings: { ...base.settings, promptCount: 1, useAutoSections: true },
      deps: makeDeps(),
    });
    expect(prompts[0].text).toBe("AB, P(cat)[pin#0], AE");
  });

  it("does not fold (no autoSink) when auto-sections are off", () => {
    const { prompts } = buildRoll({
      ...base,
      settings: { ...base.settings, promptCount: 1, useAutoSections: false },
      deps: makeDeps(),
    });
    expect(prompts[0].text).toBe("P(cat)[pin#0]");
  });

  it("mints a fresh base seed for a random roll (injected mintSeed)", () => {
    const mintSeed = vi.fn(() => "MINT");
    const { prompts, rollSeed } = buildRoll({
      ...base,
      settings: { randomSeed: true, promptCount: 2, useAutoSections: false },
      deps: makeDeps({ mintSeed }),
    });
    expect(mintSeed).toHaveBeenCalledTimes(1);
    expect(rollSeed).toBe("MINT");
    expect(prompts.map((p) => p.text)).toEqual(["P(cat)[MINT#0]", "P(cat)[MINT#1]"]);
  });

  it("each prompt row carries a fresh id, the source dpl, and an empty batches list", () => {
    const { prompts } = buildRoll({
      ...base,
      settings: { ...base.settings, promptCount: 2 },
      deps: makeDeps(),
    });
    expect(prompts[0].id).not.toBe(prompts[1].id);
    prompts.forEach((p) => {
      expect(p.dpl).toBe("cat");
      expect(p.batches).toEqual([]);
    });
  });
});
