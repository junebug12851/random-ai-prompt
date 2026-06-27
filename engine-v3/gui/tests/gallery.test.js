/**
 * @file Unit tests for the photo-gallery feed reader (gui/src/lib/gallery.js).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchGallery,
  searchHaystack,
  promptText,
  promptLayers,
  negativeLayers,
} from "../src/lib/gallery.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

const nested = {
  file: "2026-x.png",
  meta: {
    prompt: { dpl: "{#animal}", roll: "a fox", ai: "a luminous fox", final: "a luminous fox" },
    negative: { dpl: "{bad}", roll: "blurry", ai: "low quality, blurry", final: "low quality, blurry" },
    provider: "comfyui",
    providerLabel: "ComfyUI",
  },
};

describe("layer helpers", () => {
  it("reads nested prompt/negative layers", () => {
    expect(promptLayers(nested.meta).final).toBe("a luminous fox");
    expect(negativeLayers(nested.meta).ai).toBe("low quality, blurry");
  });

  it("falls back to the older flat sidecar shape", () => {
    const flat = { prompt: "a cat", promptOriginal: "cat", aiTranslation: null, negativePrompt: "blurry" };
    expect(promptLayers(flat)).toEqual({ dpl: null, roll: "cat", ai: null, final: "a cat" });
    expect(negativeLayers(flat).final).toBe("blurry");
  });

  it("promptText prefers final, then ai/roll/dpl", () => {
    expect(promptText(nested)).toBe("a luminous fox");
    expect(promptText({ meta: { prompt: { dpl: "{#x}", roll: null, ai: null, final: null } } })).toBe("{#x}");
  });
});

describe("searchHaystack", () => {
  it("collects every prompt/negative layer and the provider into one lowercase string", () => {
    const hay = searchHaystack(nested);
    expect(hay).toContain("a luminous fox");
    expect(hay).toContain("{#animal}");
    expect(hay).toContain("blurry");
    expect(hay).toContain("comfyui");
    expect(hay).toBe(hay.toLowerCase());
  });

  it("tolerates a missing sidecar (no meta)", () => {
    expect(searchHaystack({ file: "a.png", meta: null })).toBe("a.png");
  });
});

describe("fetchGallery", () => {
  it("returns the feed items on success", async () => {
    const items = [{ path: "/api/output/a.png", file: "a.png", name: "a", meta: nested.meta }];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items }) });
    await expect(fetchGallery()).resolves.toEqual(items);
  });

  it("returns an empty list when the feed endpoint is unavailable (static/online build)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("no dev server"));
    await expect(fetchGallery()).resolves.toEqual([]);
  });

  it("returns an empty list on a non-OK response or a malformed body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchGallery()).resolves.toEqual([]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    });
    await expect(fetchGallery()).resolves.toEqual([]);
  });
});
