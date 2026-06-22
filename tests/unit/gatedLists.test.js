/**
 * @file Unit tests for src/gatedLists.js — automatic NSFW gating by name token.
 */
import { describe, it, expect } from "vitest";
import {
  NSFW_TOKEN,
  hasNsfwToken,
  isGatedList,
  isGatedDynPrompt,
  gatedDynPrompts,
} from "../../src/gatedLists.js";

describe("gatedLists.hasNsfwToken", () => {
  it("matches a standalone nsfw token across delimiters", () => {
    expect(hasNsfwToken("d/general-nsfw")).toBe(true);
    expect(hasNsfwToken("clothes-nsfw")).toBe(true);
    expect(hasNsfwToken("foo.nsfw.bar")).toBe(true);
    expect(hasNsfwToken("nsfw")).toBe(true);
    expect(hasNsfwToken("nsfw/extra")).toBe(true);
  });

  it("does not match nsfw embedded in a larger word", () => {
    expect(hasNsfwToken("nsfwish")).toBe(false);
    expect(hasNsfwToken("answersfw")).toBe(false);
    expect(hasNsfwToken("color")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(hasNsfwToken("Clothes-NSFW")).toBe(true);
  });

  it("exposes the underlying regex", () => {
    expect(NSFW_TOKEN.test("a-nsfw")).toBe(true);
  });
});

describe("gatedLists gating", () => {
  it("isGatedList follows the nsfw-token rule", () => {
    expect(isGatedList("artist/nudity-nsfw")).toBe(true);
    expect(isGatedList("artist/anime")).toBe(false);
  });

  it("isGatedDynPrompt honors the token rule plus the escape-hatch list", () => {
    expect(isGatedDynPrompt("subject/nude-nsfw")).toBe(true);
    expect(isGatedDynPrompt("scene/castle")).toBe(false);
    expect(Array.isArray(gatedDynPrompts)).toBe(true);
  });
});
