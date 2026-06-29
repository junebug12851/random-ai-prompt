/**
 * @file Unit tests for gui/src/lib/providerMeta.js — the provider picker UI metadata.
 */
import { describe, it, expect } from "vitest";
import { PROVIDER_META, metaFor } from "../../src/lib/providerMeta.js";

describe("providerMeta", () => {
  it("returns a description for a known provider", () => {
    expect(metaFor("comfyui").description).toBeTruthy();
  });
  it("returns a keyUrl for BYOK providers", () => {
    expect(metaFor("openai").keyUrl).toMatch(/^https?:\/\//);
  });
  it("returns an empty object for an unknown provider", () => {
    expect(metaFor("does-not-exist")).toEqual({});
  });
  it("every entry has a non-empty description", () => {
    for (const [id, meta] of Object.entries(PROVIDER_META)) {
      expect(meta.description, id).toBeTruthy();
    }
  });
});
