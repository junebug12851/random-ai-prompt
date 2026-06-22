/**
 * @file Integration tests for the SPA's browser-engine facade
 * (web-app/src/lib/promptEngine.js). This wires the shared core engine to the
 * browser loader (Vite import.meta.glob over the real bundled data), so it exercises
 * the whole prompt system the way the SPA does — no mocks.
 */
import { describe, it, expect } from "vitest";
import {
  generatePrompts,
  expandPrompt,
  renderWrapperPart,
  getBlocks,
  getListNames,
  getPresetNames,
} from "../src/lib/promptEngine.js";

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

describe("promptEngine — building blocks & presets", () => {
  it("returns categorized building-block groups", () => {
    const blocks = getBlocks();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.some((b) => b.title === "Lists")).toBe(true);
    expect(blocks.some((b) => b.title === "Blocks")).toBe(true);
  });

  it("lists preset names without throwing", () => {
    expect(Array.isArray(getPresetNames())).toBe(true);
  });
});

describe("promptEngine — wrapper rendering", () => {
  it("compiles a DPL wrapper snippet to a token string", () => {
    expect(renderWrapperPart("hello world")).toBe("hello world");
    expect(renderWrapperPart("")).toBe("");
  });
});
