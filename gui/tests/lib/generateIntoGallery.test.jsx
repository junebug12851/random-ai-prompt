/**
 * @file Tests for gui/src/lib/gallery/generateIntoGallery.js — the Gallery's own image-generation
 * flow (the counterpart to useImageBatches for the Home list). The provider/engine/output backends
 * are mocked; we assert the placeholder lifecycle (add → reveal feed → remove), the ingest with the
 * sidecar meta, and the "no image provider" guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep the rest of the providers module real (useProvider imports engineModeFor from it); only the
// provider lookup is stubbed.
vi.mock("../../src/lib/providers/index.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getProvider: vi.fn(),
}));
vi.mock("../../src/lib/output.js", () => ({ ingestImage: vi.fn() }));
vi.mock("../../src/lib/rewrite.js", () => ({ rewritePrompt: vi.fn() }));
vi.mock("../../src/lib/sessionKeys.js", () => ({ effectiveKey: vi.fn(() => "key") }));
vi.mock("../../src/lib/promptEngine.js", () => ({
  generatePrompt: vi.fn((s) => s.prompt),
  renderWrapperPart: vi.fn(() => ""),
  expandPromptSeeded: vi.fn(() => ""),
}));
vi.mock("../../src/lib/wrapperStore.js", () => ({
  getDefaultWrapper: () => ({ start: "", end: "" }),
}));

import { generateIntoGallery } from "../../src/lib/gallery/generateIntoGallery.js";
import { getProvider } from "../../src/lib/providers/index.js";
import { ingestImage } from "../../src/lib/output.js";

function makeApiProvider(generate) {
  return {
    id: "sd",
    label: "SD",
    tier: "api",
    loadGenerate: vi.fn(async () => generate),
    loadSettings: vi.fn(async () => ({ defaults: {} })),
  };
}

const baseSettings = {
  provider: "sd",
  rewriteProvider: "none",
  promptCount: 1,
  autoFix: false,
  autoKeyword: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  ingestImage.mockResolvedValue({ path: "/api/output/x.png", file: "x.png" });
});

describe("generateIntoGallery", () => {
  it("adds placeholders, ingests the image with a sidecar, reveals the feed, then drops the placeholders", async () => {
    const generate = vi.fn(async () => ({ images: ["b64img"] }));
    getProvider.mockImplementation((id) => (id === "sd" ? makeApiProvider(generate) : null));

    const onAddPending = vi.fn();
    const onRemovePending = vi.fn();
    const onBatchDone = vi.fn(async () => {});

    const res = await generateIntoGallery({
      text: "a fox",
      settings: baseSettings,
      onAddPending,
      onRemovePending,
      onBatchDone,
    });

    expect(res.saved).toBe(1);
    // One placeholder added, labeled with the prompt, with a stable id echoed back on removal.
    expect(onAddPending).toHaveBeenCalledTimes(1);
    const added = onAddPending.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ label: "a fox" });
    expect(typeof added[0].id).toBe("string");
    expect(onRemovePending).toHaveBeenCalledWith([added[0].id]);

    // The image was funneled to disk with the nested sidecar meta shape the gallery reads back.
    expect(ingestImage).toHaveBeenCalledTimes(1);
    const [img, meta] = ingestImage.mock.calls[0];
    expect(img).toBe("b64img");
    expect(meta.provider).toBe("sd");
    expect(meta.prompt.final).toBe("a fox");

    // The feed is reloaded BEFORE the placeholder is removed (so a finished cell never flashes empty).
    expect(onBatchDone).toHaveBeenCalledTimes(1);
    expect(onBatchDone.mock.invocationCallOrder[0]).toBeLessThan(
      onRemovePending.mock.invocationCallOrder[0],
    );
  });

  it("refuses a non-image provider with a friendly error and never adds placeholders", async () => {
    getProvider.mockImplementation(() => ({ id: "mj", label: "Midjourney", tier: "syntax" }));
    const onAddPending = vi.fn();

    await expect(
      generateIntoGallery({
        text: "a fox",
        settings: baseSettings,
        onAddPending,
        onRemovePending: vi.fn(),
        onBatchDone: vi.fn(),
      }),
    ).rejects.toThrow(/image provider/i);
    expect(onAddPending).not.toHaveBeenCalled();
    expect(ingestImage).not.toHaveBeenCalled();
  });

  it("rethrows a provider failure but still clears its placeholders", async () => {
    const generate = vi.fn(async () => {
      throw new Error("boom");
    });
    getProvider.mockImplementation((id) => (id === "sd" ? makeApiProvider(generate) : null));
    const onRemovePending = vi.fn();

    await expect(
      generateIntoGallery({
        text: "a fox",
        settings: baseSettings,
        onAddPending: vi.fn(),
        onRemovePending,
        onBatchDone: vi.fn(async () => {}),
      }),
    ).rejects.toThrow("boom");
    expect(onRemovePending).toHaveBeenCalledTimes(1);
    expect(ingestImage).not.toHaveBeenCalled();
  });
});
