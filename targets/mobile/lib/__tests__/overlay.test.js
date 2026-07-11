/**
 * @file Unit test for the runtime-overlay bridge (lib/overlay.js) — it reads the user overlay (nested
 * lists + blocks + sidecars) from storage and installs it into the engine via setMetroOverlay. The
 * engine module is virtual-mocked (it isn't jest-resolvable via the metro alias).
 */
jest.mock("engine/core/metroLoader.js", () => ({ setMetroOverlay: jest.fn() }), { virtual: true });
jest.mock("../storage.js", () => ({
  readUserTree: jest.fn(),
  readUserList: jest.fn(),
  readUserBlock: jest.fn(),
  readUserSidecar: jest.fn(),
}));

import { setMetroOverlay } from "engine/core/metroLoader.js";
import * as storage from "../storage.js";
import { refreshOverlay } from "../overlay.js";

const node = (entries = [], folders = []) => ({ name: "", path: "", entries, folders });
const entry = (key, kind) => ({ key, label: key.slice(key.lastIndexOf("/") + 1), kind, hasJs: false });

beforeEach(() => jest.clearAllMocks());

describe("refreshOverlay", () => {
  it("flattens nested lists + blocks (with sidecars) and installs them into the loader", async () => {
    const moods = { name: "moods", path: "moods", entries: [entry("moods/warm", "list")], folders: [] };
    storage.readUserTree.mockImplementation(async (root) =>
      root === "lists" ? node([entry("colors", "list")], [moods]) : node([entry("fox", "generator")]),
    );
    storage.readUserList.mockImplementation(async (k) => (k === "colors" ? "red\nblue" : "hot"));
    storage.readUserBlock.mockResolvedValue("Start\n===\n{color}");
    storage.readUserSidecar.mockImplementation(async (root, k) =>
      k === "fox" ? { description: "a fox" } : {},
    );

    const counts = await refreshOverlay();

    expect(counts).toEqual({ lists: 2, blocks: 1 });
    expect(setMetroOverlay).toHaveBeenCalledTimes(1);
    const arg = setMetroOverlay.mock.calls[0][0];
    expect(arg.lists).toEqual({ colors: "red\nblue", "moods/warm": "hot" });
    expect(arg.blocks).toEqual({ fox: "Start\n===\n{color}" });
    expect(arg.blockMeta).toEqual({ fox: { description: "a fox" } });
    expect(arg.listMeta).toEqual({}); // no list sidecars in this fixture
  });

  it("installs an empty overlay when there is no user content", async () => {
    storage.readUserTree.mockResolvedValue(node());
    const counts = await refreshOverlay();
    expect(counts).toEqual({ lists: 0, blocks: 0 });
    expect(setMetroOverlay).toHaveBeenCalledWith({ lists: {}, listMeta: {}, blocks: {}, blockMeta: {} });
  });
});
