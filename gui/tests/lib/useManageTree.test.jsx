/**
 * @file Tests for gui/src/lib/manage/useManageTree.js — the Manage tab's data + CRUD hook.
 * The manage backend (manageApi) and the catalog (promptEngine) are mocked; the real display-model
 * builder (manageTree) runs over an in-memory tree. Covers tree load → models, and each file op.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";

vi.mock("../../src/lib/manageApi.js", () => ({
  getTree: vi.fn(),
  getRemoteManifest: vi.fn(),
  restoreDefault: vi.fn(),
  fsOp: vi.fn(),
}));
vi.mock("../../src/lib/promptEngine.js", () => ({
  refreshCatalog: vi.fn(() => Promise.resolve(true)),
  subscribeCatalog: vi.fn(() => () => {}),
}));

import { useManageTree } from "../../src/lib/manage/useManageTree.js";
import { getTree, getRemoteManifest, restoreDefault, fsOp } from "../../src/lib/manageApi.js";
import { dialog } from "../../src/lib/dialog.js";

const wrapper = ({ children }) => (
  <IntlProvider locale="en" messages={{}} onError={() => {}}>
    {children}
  </IntlProvider>
);

const TREE = {
  "dynamic-prompts": {
    name: "",
    files: [],
    dirs: [{ name: "scene", files: ["castle.dpl"], dirs: [] }],
  },
  lists: {
    name: "",
    files: [],
    dirs: [
      { name: "look", files: ["color.txt", "clothes.txt"], dirs: [] },
      { name: "danbooru", files: [], dirs: [] },
    ],
  },
  // The user-overlay roots (grouped on top). Empty here — the overlay is a separate content pool.
  "user-blocks": { name: "", files: [], dirs: [] },
  "user-lists": { name: "", files: [], dirs: [] },
};

function mount() {
  return renderHook(
    () => useManageTree({ settings: { includeAdult: false }, available: true, active: true }),
    { wrapper },
  );
}

async function mountLoaded() {
  const h = mount();
  await waitFor(() => expect(h.result.current.models.length).toBe(4));
  return h;
}

beforeEach(() => {
  vi.clearAllMocks();
  getTree.mockResolvedValue(TREE);
  getRemoteManifest.mockResolvedValue({});
  fsOp.mockResolvedValue({});
  restoreDefault.mockResolvedValue({});
  global.EventSource = class {
    close() {}
  };
  dialog.prompt = vi.fn();
  dialog.confirm = vi.fn();
});

describe("useManageTree", () => {
  it("loads the tree and builds a model per root when active + available", async () => {
    const { result } = await mountLoaded();
    expect(getTree).toHaveBeenCalled();
    // The user-overlay roots group first, then the built-in catalog.
    expect(result.current.models.map((m) => m.root)).toEqual([
      "user-blocks",
      "user-lists",
      "dynamic-prompts",
      "lists",
    ]);
  });

  it("newFile writes via fsOp(mkfile) and selects the new entry", async () => {
    dialog.prompt.mockResolvedValue("forest");
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.newFile("lists", "look");
    });
    expect(fsOp).toHaveBeenCalledWith("mkfile", {
      root: "lists",
      path: "look/forest.txt",
      text: "",
    });
    expect(result.current.selected).toMatchObject({
      type: "entry",
      root: "lists",
      path: "look/forest",
      ext: "txt",
      kind: "list",
      label: "forest",
    });
  });

  it("newFile on a block root uses the .dpl extension + boilerplate", async () => {
    dialog.prompt.mockResolvedValue("hero");
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.newFile("dynamic-prompts", "scene");
    });
    expect(fsOp).toHaveBeenCalledWith("mkfile", {
      root: "dynamic-prompts",
      path: "scene/hero.dpl",
      text: "hero\n===\n",
    });
  });

  it("newFile is a no-op when the prompt is cancelled", async () => {
    dialog.prompt.mockResolvedValue(null);
    const { result } = await mountLoaded();
    fsOp.mockClear();
    await act(async () => {
      await result.current.newFile("lists", "look");
    });
    expect(fsOp).not.toHaveBeenCalled();
  });

  it("deleteEntry deletes the file when confirmed", async () => {
    dialog.confirm.mockResolvedValue(true);
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.deleteEntry({ root: "lists", path: "look/color", ext: "txt", label: "color" });
    });
    expect(fsOp).toHaveBeenCalledWith("delete", { root: "lists", path: "look/color.txt" });
  });

  it("deleteEntry is a no-op when not confirmed", async () => {
    dialog.confirm.mockResolvedValue(false);
    const { result } = await mountLoaded();
    fsOp.mockClear();
    await act(async () => {
      await result.current.deleteEntry({ root: "lists", path: "look/color", ext: "txt", label: "color" });
    });
    expect(fsOp).not.toHaveBeenCalled();
  });

  it("moveEntryTo relocates the entry's file into the destination folder", async () => {
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.moveEntryTo(
        { root: "lists", path: "look/color", ext: "txt", label: "color" },
        "lists",
        "danbooru",
      );
    });
    expect(fsOp).toHaveBeenCalledWith("move", {
      root: "lists",
      path: "look/color.txt",
      to: "danbooru/color.txt",
    });
  });

  it("restoreGhost restores the file from the stable branch", async () => {
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.restoreGhost({ root: "lists", path: "look/old", ext: "txt", label: "old" });
    });
    expect(restoreDefault).toHaveBeenCalledWith("lists", "look/old.txt");
  });

  it("toggle flips a folder's expanded state", async () => {
    const { result } = await mountLoaded();
    const key = "lists:look";
    const before = result.current.expanded.has(key);
    act(() => result.current.toggle(key));
    expect(result.current.expanded.has(key)).toBe(!before);
  });
});
