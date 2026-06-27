/**
 * @file Unit tests for the photo-gallery feed reader (gui/src/lib/gallery.js).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGallery, searchHaystack } from "../src/lib/gallery.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe("searchHaystack", () => {
  it("collects prompt, DPL, AI translation, and provider into one lowercase string", () => {
    const item = {
      file: "2026-x.png",
      meta: {
        prompt: "A Glowing FOX",
        promptOriginal: "fox",
        aiTranslation: "a luminous fox",
        dpl: "{#animal}",
        provider: "comfyui",
        providerLabel: "ComfyUI",
      },
    };
    const hay = searchHaystack(item);
    expect(hay).toContain("a glowing fox");
    expect(hay).toContain("{#animal}");
    expect(hay).toContain("luminous");
    expect(hay).toContain("comfyui");
    expect(hay).toBe(hay.toLowerCase());
  });

  it("tolerates a missing sidecar (no meta)", () => {
    expect(searchHaystack({ file: "a.png", meta: null })).toBe("a.png");
  });
});

describe("fetchGallery", () => {
  it("returns the feed items on success, newest first as the server sent them", async () => {
    const items = [
      { path: "/api/output/b.png", file: "b.png", name: "b", meta: { prompt: "two" } },
      { path: "/api/output/a.png", file: "a.png", name: "a", meta: { prompt: "one" } },
    ];
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
