/**
 * @file Unit tests for gui/src/lib/output.js — the central output-folder helper.
 * Network calls are intercepted with MSW; the new-tab opener stubs window.open + URL.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import {
  ingestImage,
  isOutputFile,
  openImageInNewTab,
  deleteImageFile,
  updateImageMeta,
} from "../../frontend/lib/output.js";

afterEach(() => vi.restoreAllMocks());

describe("ingestImage", () => {
  it("returns the served path when the dev server saves it", async () => {
    server.use(http.post("/api/image", () => HttpResponse.json({ path: "/api/output/x.png" })));
    expect(await ingestImage("data:image/png;base64,AAAA")).toBe("/api/output/x.png");
  });

  it("falls back to the original source on a server error", async () => {
    server.use(http.post("/api/image", () => new HttpResponse(null, { status: 500 })));
    expect(await ingestImage("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("falls back to the source when there is no dev server (network error)", async () => {
    server.use(http.post("/api/image", () => HttpResponse.error()));
    expect(await ingestImage("blob:abc")).toBe("blob:abc");
  });
});

describe("isOutputFile", () => {
  it("recognizes served output paths only", () => {
    expect(isOutputFile("/api/output/a.png")).toBe(true);
    expect(isOutputFile("https://x/y.png")).toBe(false);
    expect(isOutputFile(null)).toBe(false);
  });
});

describe("openImageInNewTab", () => {
  it("turns a data URL into a blob URL before opening (avoids popup blocking)", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:created"),
      revokeObjectURL: vi.fn(),
    });
    openImageInNewTab("data:image/png;base64,AAAA");
    expect(open).toHaveBeenCalledWith("blob:created", "_blank", "noopener");
    vi.unstubAllGlobals();
  });

  it("opens a non-data URL directly", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openImageInNewTab("/api/output/a.png");
    expect(open).toHaveBeenCalledWith("/api/output/a.png", "_blank", "noopener");
  });

  it("does nothing for an empty image", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openImageInNewTab("");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("file actions", () => {
  it("deleteImageFile posts to the action endpoint for an output path", async () => {
    server.use(http.post("/api/image/delete", () => HttpResponse.json({ ok: true })));
    expect(await deleteImageFile("/api/output/a.png")).toBe(true);
  });

  it("file actions are a no-op (false) for a non-output path", async () => {
    expect(await deleteImageFile("https://x/y.png")).toBe(false);
  });

  it("updateImageMeta returns the merged sidecar, or null off a non-output path", async () => {
    server.use(http.post("/api/image/meta", () => HttpResponse.json({ meta: { keywords: ["a"] } })));
    expect(await updateImageMeta("/api/output/a.png", { keywords: ["a"] })).toEqual({
      keywords: ["a"],
    });
    expect(await updateImageMeta("https://x/y.png", {})).toBeNull();
  });
});
