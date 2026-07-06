/**
 * @file Unit tests for gui/src/lib/manageTree.js — the Manage tab display model
 * (categories, implied groups, force-prefix, NSFW hiding, ghosts, filtering).
 */
import { describe, it, expect } from "vitest";
import {
  buildManageModel,
  computeGhosts,
  injectGhosts,
  filterModel,
} from "../../frontend/lib/manageTree.js";

const listsTree = {
  name: "",
  files: [],
  dirs: [
    { name: "look", files: ["color.txt", "clothes-sfw.txt", "clothes-nsfw.txt"], dirs: [] },
    {
      name: "danbooru",
      files: ["_force-prefix"],
      dirs: [{ name: "d", files: ["general.txt", "artist.txt"], dirs: [] }],
    },
  ],
};

describe("buildManageModel", () => {
  it("treats top-level folders as categories", () => {
    const model = buildManageModel(listsTree, "lists", { includeAdult: false });
    const cats = model.children.map((c) => c.name).sort();
    expect(cats).toEqual(["danbooru", "look"]);
    expect(model.children.every((c) => c.isCategory)).toBe(true);
  });

  it("hides NSFW entries when adult is off, shows them when on", () => {
    const off = buildManageModel(listsTree, "lists", { includeAdult: false });
    const look = off.children.find((c) => c.name === "look");
    const labels = look.entries.map((e) => e.label);
    expect(labels).toContain("color");
    expect(labels).toContain("clothes-sfw");
    expect(labels).not.toContain("clothes-nsfw");

    const on = buildManageModel(listsTree, "lists", { includeAdult: true });
    const lookOn = on.children.find((c) => c.name === "look");
    expect(lookOn.entries.map((e) => e.label)).toContain("clothes-nsfw");
  });

  it("marks a 2+ list folder as an implied group and a _force-prefix folder", () => {
    const model = buildManageModel(listsTree, "lists", { includeAdult: true });
    const danbooru = model.children.find((c) => c.name === "danbooru");
    expect(danbooru.forcePrefix).toBe(true);
    const d = danbooru.children.find((c) => c.name === "d");
    expect(d.isGroup).toBe(true);
  });
});

describe("filterModel", () => {
  it("keeps a folder when an entry matches and drops non-matches", () => {
    const model = buildManageModel(listsTree, "lists", { includeAdult: true });
    const filtered = filterModel(model, "color");
    const look = filtered.children.find((c) => c.name === "look");
    expect(look.entries.map((e) => e.label)).toEqual(["color"]);
    // danbooru has no "color" entry → pruned
    expect(filtered.children.find((c) => c.name === "danbooru")).toBeUndefined();
  });

  it("returns the node unchanged for an empty query", () => {
    const model = buildManageModel(listsTree, "lists", {});
    expect(filterModel(model, "")).toBe(model);
  });
});

describe("computeGhosts / injectGhosts", () => {
  it("surfaces upstream files missing locally (NSFW hidden when adult off)", () => {
    const localEmpty = { name: "", files: [], dirs: [] };
    const manifest = ["look/color.txt", "look/secret-nsfw.txt"];
    const off = computeGhosts(localEmpty, manifest, "lists", { includeAdult: false });
    expect(off.map((g) => g.path)).toEqual(["look/color"]);
    const on = computeGhosts(localEmpty, manifest, "lists", { includeAdult: true });
    expect(on.map((g) => g.path).sort()).toEqual(["look/color", "look/secret-nsfw"]);
  });

  it("injects a ghost into a freshly-created folder node", () => {
    const model = buildManageModel({ name: "", files: [], dirs: [] }, "lists", {});
    const ghosts = computeGhosts(
      { name: "", files: [], dirs: [] },
      ["newcat/thing.txt"],
      "lists",
      {},
    );
    injectGhosts(model, ghosts);
    const cat = model.children.find((c) => c.name === "newcat");
    expect(cat).toBeTruthy();
    expect(cat.entries.some((e) => e.label === "thing" && e.ghost)).toBe(true);
  });
});
