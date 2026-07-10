/**
 * @file Unit tests for phone-local storage (lib/storage.js) — expo-file-system/legacy mocked. Covers
 * saving an image + its index entry, listing (filter/sort/merge), bulk delete pruning, and meta merge.
 */
import * as FS from "expo-file-system/legacy";
import { saveImageSrc, listImages, deleteImages, updateImageMeta } from "../storage.js";

beforeEach(() => {
  jest.clearAllMocks();
  FS.getInfoAsync.mockResolvedValue({ exists: true });
  FS.readAsStringAsync.mockResolvedValue("{}");
  FS.readDirectoryAsync.mockResolvedValue([]);
});

describe("storage", () => {
  it("saveImageSrc writes a data: image + an index entry and returns {name,uri}", async () => {
    const res = await saveImageSrc("data:image/png;base64,AAAA", { prompt: "p", provider: "comfyui", seed: 42 });
    expect(res.name).toMatch(/^img-.*\.png$/);
    expect(res.uri).toContain("images/");
    // one write for the image bytes, one for the index
    expect(FS.writeAsStringAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("listImages filters non-images, sorts newest-first, and merges metadata", async () => {
    FS.readDirectoryAsync.mockResolvedValueOnce(["img-1.png", "img-2.png", "note.txt"]);
    FS.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ "img-1.png": { prompt: "one" } }));
    const items = await listImages();
    expect(items.map((i) => i.name)).toEqual(["img-2.png", "img-1.png"]);
    expect(items.find((i) => i.name === "img-1.png").prompt).toBe("one");
  });

  it("deleteImages deletes files and prunes the index", async () => {
    FS.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ "a.png": {}, "b.png": {} }));
    await deleteImages(["file:///doc/rap/images/a.png"]);
    expect(FS.deleteAsync).toHaveBeenCalled();
    expect(FS.writeAsStringAsync).toHaveBeenCalled();
  });

  it("updateImageMeta merges a patch into an existing entry, else null", async () => {
    FS.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ "a.png": { prompt: "p" } }));
    const merged = await updateImageMeta("file:///doc/rap/images/a.png", { keywords: ["x"] });
    expect(merged).toMatchObject({ prompt: "p", keywords: ["x"] });
    FS.readAsStringAsync.mockResolvedValueOnce("{}");
    expect(await updateImageMeta("file:///doc/rap/images/z.png", {})).toBeNull();
  });
});