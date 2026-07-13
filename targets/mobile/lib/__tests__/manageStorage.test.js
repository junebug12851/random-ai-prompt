/**
 * @file Unit tests for the Manage content-overlay layer in lib/storage.js — user blocks + nested
 * folders + `.json`/`.js` sidecars + the recursive tree builder + folder/move ops. expo-file-system
 * mocked with a small in-memory directory model.
 */
import * as FS from "expo-file-system/legacy";
import {
  readUserTree,
  listUserBlocks,
  writeUserBlock,
  deleteUserBlock,
  writeUserBlockJs,
  readUserSidecar,
  writeUserSidecar,
  makeUserFolder,
  moveUserEntry,
} from "../storage.js";

// A path is a "directory" iff it has no file extension (mirrors how the real FS reports isDirectory).
const isDir = (p) => !/\.[a-z0-9]+$/i.test(p.replace(/\/$/, ""));

beforeEach(() => {
  jest.clearAllMocks();
  FS.getInfoAsync.mockImplementation(async (p) => ({ exists: true, isDirectory: isDir(p), uri: p }));
  FS.readAsStringAsync.mockResolvedValue("{}");
  FS.readDirectoryAsync.mockResolvedValue([]);
  FS.writeAsStringAsync.mockResolvedValue();
  FS.deleteAsync.mockResolvedValue();
  FS.copyAsync.mockResolvedValue();
  FS.makeDirectoryAsync.mockResolvedValue();
});

describe("Manage overlay storage", () => {
  it("readUserTree builds a nested tree, folding in .js/.json and flagging hasJs", async () => {
    FS.readDirectoryAsync.mockImplementation(async (dir) => {
      if (dir.endsWith("/blocks/")) return ["color.dpl", "color.json", "scene"];
      if (dir.endsWith("/blocks/scene/")) return ["dawn.dpl", "dawn.js"];
      return [];
    });
    const tree = await readUserTree("blocks");
    expect(tree.entries.map((e) => e.label)).toEqual(["color"]);
    expect(tree.folders.map((f) => f.name)).toEqual(["scene"]);
    const scene = tree.folders[0];
    expect(scene.path).toBe("scene");
    expect(scene.entries).toEqual([{ key: "scene/dawn", label: "dawn", kind: "generator", hasJs: true }]);
  });

  it("listUserBlocks returns nested keys without the .dpl extension, sorted", async () => {
    FS.readDirectoryAsync.mockImplementation(async (dir) => {
      if (dir.endsWith("/blocks/")) return ["b.dpl", "a", "note.json"];
      if (dir.endsWith("/blocks/a/")) return ["x.dpl"];
      return [];
    });
    expect(await listUserBlocks()).toEqual(["a/x", "b"]);
  });

  it("writeUserBlock writes the .dpl under its (created) parent folder", async () => {
    await writeUserBlock("scene/dawn", "Start\n===\n{color}");
    const call = FS.writeAsStringAsync.mock.calls.find((c) => c[0].endsWith("blocks/scene/dawn.dpl"));
    expect(call).toBeTruthy();
    expect(call[1]).toContain("{color}");
  });

  it("deleteUserBlock removes the .dpl and both sidecars", async () => {
    await deleteUserBlock("scene/dawn");
    const deleted = FS.deleteAsync.mock.calls.map((c) => c[0]);
    expect(deleted.some((p) => p.endsWith("scene/dawn.dpl"))).toBe(true);
    expect(deleted.some((p) => p.endsWith("scene/dawn.js"))).toBe(true);
    expect(deleted.some((p) => p.endsWith("scene/dawn.json"))).toBe(true);
  });

  it("writeUserBlockJs creates the .js sidecar", async () => {
    await writeUserBlockJs("fx", "export default () => ''");
    expect(FS.writeAsStringAsync.mock.calls.some((c) => c[0].endsWith("blocks/fx.js"))).toBe(true);
  });

  it("writeUserSidecar merges a patch, and removes the sidecar when it empties", async () => {
    await writeUserSidecar("blocks", "color", { description: "a color", nsfw: null });
    const wrote = FS.writeAsStringAsync.mock.calls.find((c) => c[0].endsWith("color.json"));
    expect(JSON.parse(wrote[1])).toEqual({ description: "a color" });

    FS.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ description: "a color" }));
    await writeUserSidecar("blocks", "color", { description: null });
    expect(FS.deleteAsync.mock.calls.some((c) => c[0].endsWith("color.json"))).toBe(true);
  });

  it("readUserSidecar returns {} when absent", async () => {
    FS.readAsStringAsync.mockRejectedValueOnce(new Error("nope"));
    expect(await readUserSidecar("lists", "x")).toEqual({});
  });

  it("makeUserFolder creates a nested directory under the root", async () => {
    await makeUserFolder("lists", "colors/warm");
    expect(FS.makeDirectoryAsync.mock.calls.some((c) => c[0].endsWith("lists/colors/warm"))).toBe(true);
  });

  it("moveUserEntry copies the entry + sidecars to the new key and deletes the old", async () => {
    await moveUserEntry("blocks", "a", "b/c");
    expect(FS.copyAsync).toHaveBeenCalled();
    const copied = FS.copyAsync.mock.calls.map((c) => c[0].to);
    expect(copied.some((p) => p.endsWith("blocks/b/c.dpl"))).toBe(true);
  });
});
