/**
 * @file Tests for gui/src/lib/manage/useManageTree.js — the Manage tab's data + CRUD hook.
 * The manage backend (manageApi) and the catalog (promptEngine) are mocked; the real display-model
 * builder (manageTree) runs over an in-memory tree. Covers tree load → models, and each file op.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";

vi.mock("../../frontend/lib/manageApi.js", () => ({
  getTree: vi.fn(),
  getRemoteManifest: vi.fn(),
  restoreDefault: vi.fn(),
  fsOp: vi.fn(),
}));
vi.mock("../../frontend/lib/promptEngine.js", () => ({
  refreshCatalog: vi.fn(() => Promise.resolve(true)),
  subscribeCatalog: vi.fn(() => () => {}),
}));

import { useManageTree } from "../../frontend/lib/manage/useManageTree.js";
import { getTree, getRemoteManifest, restoreDefault, fsOp } from "../../frontend/lib/manageApi.js";
import { dialog } from "../../frontend/lib/dialog.js";

const wrapper = ({ children }) => (
  <IntlProvider locale="en" messages={{}} onError={() => {}}>
    {children}
  </IntlProvider>
);

const TREE = {
  "blocks": {
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
      "blocks",
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
      await result.current.newFile("blocks", "scene");
    });
    expect(fsOp).toHaveBeenCalledWith("mkfile", {
      root: "blocks",
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

  it("overrideEntry copies a built-in's files into the user overlay and selects the copy", async () => {
    dialog.confirm.mockResolvedValue(true);
    const { result } = await mountLoaded();
    const entry = { root: "blocks", path: "scene/castle", ext: "dpl", kind: "generator", label: "castle" };
    await act(async () => {
      await result.current.overrideEntry(entry);
    });
    expect(fsOp).toHaveBeenCalledWith("copy", {
      root: "blocks",
      path: "scene/castle.dpl",
      toRoot: "user-blocks",
      to: "scene/castle.dpl",
    });
    // Sidecars are attempted too (ignored if absent).
    expect(fsOp).toHaveBeenCalledWith("copy", expect.objectContaining({ to: "scene/castle.json", toRoot: "user-blocks" }));
    expect(result.current.selected).toMatchObject({ type: "entry", root: "user-blocks", path: "scene/castle", label: "castle" });
  });

  it("overrideEntry is a no-op when not confirmed", async () => {
    dialog.confirm.mockResolvedValue(false);
    const { result } = await mountLoaded();
    fsOp.mockClear();
    await act(async () => {
      await result.current.overrideEntry({ root: "lists", path: "look/color", ext: "txt", label: "color" });
    });
    expect(fsOp).not.toHaveBeenCalled();
  });

  it("overrideEntry ignores entries already in the user overlay", async () => {
    const { result } = await mountLoaded();
    fsOp.mockClear();
    await act(async () => {
      await result.current.overrideEntry({ root: "user-blocks", path: "x", ext: "dpl", label: "x" });
    });
    expect(dialog.confirm).not.toHaveBeenCalled();
    expect(fsOp).not.toHaveBeenCalled();
  });

  it("overrideEntry opens the existing copy when an override already exists", async () => {
    dialog.confirm.mockResolvedValue(true);
    fsOp.mockRejectedValueOnce(new Error("Destination exists")); // the main copy
    const { result } = await mountLoaded();
    await act(async () => {
      await result.current.overrideEntry({ root: "blocks", path: "scene/castle", ext: "dpl", kind: "generator", label: "castle" });
    });
    expect(result.current.selected).toMatchObject({ type: "entry", root: "user-blocks", path: "scene/castle" });
    expect(result.current.error).toBe("");
  });

  it("toggle flips a folder's expanded state", async () => {
    const { result } = await mountLoaded();
    const key = "lists:look";
    const before = result.current.expanded.has(key);
    act(() => result.current.toggle(key));
    expect(result.current.expanded.has(key)).toBe(!before);
  });
});
