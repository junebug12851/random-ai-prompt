/**
 * @file Unit tests for the share-link codec (gui/src/lib/share.js).
 */
import { describe, it, expect } from "vitest";
import { shareUrl, readSharedSettings } from "../src/lib/share.js";

describe("share links", () => {
  it("round-trips settings through the URL hash", () => {
    const settings = { prompt: "{#random-words}", promptCount: 4, mode: "NovelAI" };
    const url = shareUrl(settings);
    expect(url).toContain("#s=");
    const hash = url.slice(url.indexOf("#"));
    expect(readSharedSettings(hash)).toEqual(settings);
  });

  it("never includes secret API keys in the link", () => {
    const url = shareUrl({ prompt: "x", keys: { openai: "sk-secret" } });
    const decoded = readSharedSettings(url.slice(url.indexOf("#")));
    expect(decoded).not.toHaveProperty("keys");
    expect(url).not.toContain("sk-secret");
  });

  it("handles unicode safely", () => {
    const settings = { prompt: "café 日本語 🦊" };
    const url = shareUrl(settings);
    expect(readSharedSettings(url.slice(url.indexOf("#")))).toEqual(settings);
  });

  it("returns null for a missing or malformed hash", () => {
    expect(readSharedSettings("#nothing")).toBeNull();
    expect(readSharedSettings("#s=%%%not-base64%%%")).toBeNull();
  });
});
