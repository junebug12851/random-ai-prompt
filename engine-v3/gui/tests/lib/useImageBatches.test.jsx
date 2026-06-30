/**
 * @file Tests for gui/src/lib/home/useImageBatches.js — the generated-prompt list + image-batch
 * lifecycle hook. The output/rewrite/engine/key backends are mocked; the batch run and the
 * remove/clear handlers are exercised against the resulting state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";

vi.mock("../../src/lib/output.js", () => ({
  ingestImage: vi.fn(),
  isOutputFile: vi.fn(() => false),
  deleteImageFile: vi.fn(),
}));
vi.mock("../../src/lib/rewrite.js", () => ({ rewritePrompt: vi.fn() }));
vi.mock("../../src/lib/promptEngine.js", () => ({ expandPrompt: vi.fn(() => "") }));
vi.mock("../../src/lib/sessionKeys.js", () => ({ effectiveKey: vi.fn(() => "key") }));

import { useImageBatches } from "../../src/lib/home/useImageBatches.js";
import { ingestImage, isOutputFile, deleteImageFile } from "../../src/lib/output.js";
import { dialog } from "../../src/lib/dialog.js";

const wrapper = ({ children }) => (
  <IntlProvider locale="en" messages={{}} onError={() => {}}>
    {children}
  </IntlProvider>
);

const settings = { rewriteProvider: "none", autoFix: false, autoKeyword: false };
const flat = { batchSize: 1, negativePrompt: "", mode: "StableDiffusion" };

function mount(provider = makeProvider()) {
  return renderHook(() => useImageBatches({ settings, provider, flat }), { wrapper });
}

function makeProvider() {
  const generate = vi.fn(async () => ({ images: ["b64img"] }));
  return { id: "sd", label: "SD", loadGenerate: vi.fn(async () => generate), _generate: generate };
}

beforeEach(() => {
  vi.clearAllMocks();
  isOutputFile.mockReturnValue(false);
  ingestImage.mockResolvedValue({ path: "/api/output/x.png", file: "x.png" });
  dialog.confirm = vi.fn(async () => true);
});

describe("useImageBatches.makeBatch", () => {
  it("runs the provider, ingests the image, and lands it in a finished batch", async () => {
    const { result } = mount();
    act(() => result.current.setPrompts([{ id: 1, text: "a fox", dpl: "dpl", batches: [] }]));
    await act(async () => {
      await result.current.makeBatch(1, "a fox", "dpl");
    });
    await waitFor(() => expect(result.current.prompts[0].batches[0]?.busy).toBe(false));
    expect(ingestImage).toHaveBeenCalledTimes(1);
    expect(result.current.prompts[0].batches[0].images).toEqual([
      { path: "/api/output/x.png", file: "x.png" },
    ]);
  });
});

describe("useImageBatches lifecycle handlers", () => {
  it("removeImage drops one image (and removes the batch when it empties)", async () => {
    const { result } = mount();
    act(() =>
      result.current.setPrompts([
        { id: 1, batches: [{ id: 9, busy: false, images: ["a", "b"] }] },
      ]),
    );
    await act(async () => {
      await result.current.removeImage(1, 9, "a");
    });
    expect(result.current.prompts[0].batches[0].images).toEqual(["b"]);
  });

  it("removeBatch drops the whole batch", async () => {
    const { result } = mount();
    act(() =>
      result.current.setPrompts([
        { id: 1, batches: [{ id: 9, images: ["a"] }, { id: 10, images: ["b"] }] },
      ]),
    );
    await act(async () => {
      await result.current.removeBatch(1, 9);
    });
    expect(result.current.prompts[0].batches.map((b) => b.id)).toEqual([10]);
  });

  it("clearImages empties a prompt's batches", async () => {
    const { result } = mount();
    act(() => result.current.setPrompts([{ id: 1, batches: [{ id: 9, images: ["a"] }] }]));
    await act(async () => {
      await result.current.clearImages(1);
    });
    expect(result.current.prompts[0].batches).toEqual([]);
  });

  it("clearAll empties the whole list", async () => {
    const { result } = mount();
    act(() => result.current.setPrompts([{ id: 1, batches: [{ id: 9, images: ["a"] }] }]));
    await act(async () => {
      await result.current.clearAll();
    });
    expect(result.current.prompts).toEqual([]);
  });

  it("deletes the file from disk when the image is an on-disk output and confirmed", async () => {
    isOutputFile.mockReturnValue(true);
    const { result } = mount();
    act(() => result.current.setPrompts([{ id: 1, batches: [{ id: 9, images: ["/api/output/a.png"] }] }]));
    await act(async () => {
      await result.current.removeImage(1, 9, "/api/output/a.png");
    });
    expect(deleteImageFile).toHaveBeenCalledWith("/api/output/a.png");
  });
});
