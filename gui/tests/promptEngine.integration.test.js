/**
 * @file Integration tests for the SPA's browser-engine facade
 * (gui/src/lib/promptEngine.js). This wires the shared core engine to the
 * browser loader (Vite import.meta.glob over the real bundled data), so it exercises
 * the whole prompt system the way the SPA does — no mocks.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  generatePrompt,
  generatePrompts,
  expandPrompt,
  renderWrapperPart,
  getBlocks,
  getListNames,
  getPresetNames,
  ensureCatalog,
} from "../src/lib/promptEngine.js";

// The bundled catalog now loads lazily/asynchronously (kept off the first-paint graph), so trigger +
// await it before exercising generation/blocks — mirrors how the SPA loads it from a mount effect.
beforeAll(() => ensureCatalog());

const settings = {
  prompt: "{#random-words}",
  promptCount: 1,
  mode: "StableDiffusion",
  keywordCount: 3,
  keywordMaxCount: 4,
  keywordsFilename: "keyword",
  artistFilename: "artist",
  keywordEmphasis: true,
  emphasisChance: 0.25,
  includeArtist: false,
  includeAdult: false,
  listEntriesUsedOnce: true,
  autoAddFx: false,
  autoAddArtists: false,
};

describe("promptEngine — generation", () => {
  it("generates the requested number of non-empty prompts", () => {
    const out = generatePrompts({ ...settings, promptCount: 3 });
    expect(out).toHaveLength(3);
    out.forEach((p) => expect(p.trim().length).toBeGreaterThan(0));
  });

  it("leaves no unresolved {…} / <…> tokens in the output", () => {
    const out = generatePrompts({ ...settings, promptCount: 5 });
    out.forEach((p) => {
      expect(p).not.toContain("{#");
      expect(p).not.toMatch(/<[a-z]/i);
    });
  });

  it("resolves a concrete {list} token via the bundled data", () => {
    const lists = getListNames();
    expect(lists.length).toBeGreaterThan(0);
    const out = expandPrompt("{color}", settings);
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).not.toContain("{color}");
  });
});

describe("promptEngine — seed / reroll (regression)", () => {
  // Faithful to the reported bug + the follow-up design. The GUI's default settings carry the
  // image-provider `seed: -1`; that must NEVER reach prompt generation. Random-vs-pinned is driven by
  // the explicit `randomSeed` toggle, not by any magic seed value. Both cases are exercised WITH the
  // image seed present, and WITH emphasis on (the pass that exposed the duplicate-RNG-instance bug —
  // a pinned seed has to reproduce the emphasis decoration too, not just the word picks).
  const rollBase = { ...settings, seed: -1, prompt: "{color} {color} {color}" };
  const emphOn = {
    ...rollBase,
    keywordEmphasis: true,
    emphasisChance: 0.5,
    emphasisLevelChance: 0.5,
    emphasisMaxLevels: 3,
    deEmphasisChance: 0.25,
  };
  const distinct = (s) => new Set(Array.from({ length: 40 }, () => generatePrompt(s))).size;

  it("Random ON (default): rerolls fresh prompts, even with the image seed at -1", () => {
    expect(distinct({ ...rollBase, randomSeed: true })).toBeGreaterThan(1);
  });

  it("Random ON with emphasis: still rerolls fresh (nothing pins it)", () => {
    expect(distinct({ ...emphOn, randomSeed: true })).toBeGreaterThan(1);
  });

  it("Random OFF: a pinned promptSeed reproduces the exact prompt", () => {
    const s = { ...rollBase, randomSeed: false, promptSeed: "pin-42" };
    expect(generatePrompt(s)).toBe(generatePrompt(s));
  });

  it("Random OFF with emphasis: pinned seed reproduces the EMPHASIS too (RNG-instance fix)", () => {
    const s = { ...emphOn, randomSeed: false, promptSeed: "pin-42" };
    const a = generatePrompt(s);
    const b = generatePrompt(s);
    expect(a).toBe(b);
  });

  it("an explicit forced seed reproduces regardless of the toggle (batch fork path)", () => {
    // The Home roll forks one base seed as `base#i` per prompt; the same forced seed must reproduce.
    expect(generatePrompt(emphOn, "roll#0")).toBe(generatePrompt(emphOn, "roll#0"));
    expect(generatePrompt(emphOn, "roll#0")).not.toBe(generatePrompt(emphOn, "roll#1"));
  });

  it("negative and zero seeds are valid pins (no reserved magic values)", () => {
    for (const promptSeed of ["-1", "0", "-9999"]) {
      const s = { ...rollBase, randomSeed: false, promptSeed };
      expect(generatePrompt(s)).toBe(generatePrompt(s));
    }
  });

  it("free-text seeds (letters, spaces, symbols, emoji) are valid pins", () => {
    for (const promptSeed of ["hello world", "My Seed 42!", "  spaced  ", "🦊 fairy fox", "a"]) {
      const s = { ...emphOn, randomSeed: false, promptSeed };
      expect(generatePrompt(s)).toBe(generatePrompt(s)); // reproducible
    }
  });

  it("different free-text seeds generally produce different prompts", () => {
    const seeds = ["alpha", "beta", "gamma", "the quick brown fox", "seed-123"];
    const outs = seeds.map((promptSeed) =>
      generatePrompt({ ...emphOn, randomSeed: false, promptSeed }),
    );
    expect(new Set(outs).size).toBeGreaterThan(1);
  });
});

describe("promptEngine — building blocks & presets", () => {
  it("returns categorized building-block groups", () => {
    const blocks = getBlocks();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.some((b) => b.title === "Lists")).toBe(true);
    const blocksTab = blocks.find((b) => b.title === "Blocks");
    expect(blocksTab).toBeTruthy();
    // The Blocks list must contain real generator chips (non-category items), not just headers.
    expect(blocksTab.items.some((i) => !i.category)).toBe(true);
  });

  it("lists preset names without throwing", () => {
    expect(Array.isArray(getPresetNames())).toBe(true);
  });

  it("orders the Blocks category pills by sidecar priority", () => {
    const blocksTab = getBlocks().find((b) => b.title === "Blocks");
    const cats = blocksTab.items.filter((i) => i.category).map((i) => i.label);
    // The virtual wildcard leads and engine controls trail.
    expect(cats[0]).toBe("any");
    expect(cats[cats.length - 1]).toBe("special");
    // The curated folder order (priority 200..700) sits in between, in this sequence.
    const idx = (name) => cats.indexOf(name);
    for (const [a, b] of [
      ["prompt", "scene"],
      ["scene", "subject"],
      ["subject", "style"],
      ["style", "fragment"],
      ["fragment", "user"],
    ]) {
      expect(idx(a)).toBeGreaterThanOrEqual(0);
      expect(idx(b)).toBeGreaterThan(idx(a));
    }
  });
});

describe("promptEngine — wrapper rendering", () => {
  it("compiles a DPL wrapper snippet to a token string", () => {
    expect(renderWrapperPart("hello world")).toBe("hello world");
    expect(renderWrapperPart("")).toBe("");
  });
});
