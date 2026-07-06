/**
 * @file Contract tests for the Manage tab's local-mode backend (`gui/server/manageFs.js`) and the
 * tree/ghost model (`gui/src/lib/manageTree.js`). Verifies the disk snapshot reproduces the engine's
 * own catalog, the write/sidecar/marker/move/delete ops round-trip through the snapshot (in an
 * isolated throwaway folder), the traversal guard holds, and ghost detection is exact.
 */
import { describe, it, expect, afterAll, afterEach } from "vitest";
import {
  buildManageSnapshot,
  buildManageTree,
  mergeSidecar,
  setMarker,
  fsOp,
  restoreFromRepo,
  MANAGE_ROOTS,
} from "../../gui/server/manageFs.js";
import { computeGhosts, buildManageModel } from "../../gui/src/lib/manageTree.js";
import { nodeLoader } from "../../src/core/nodeLoader.js";
import {
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  compareNames,
} from "../../src/listManifest.js";

const sortEq = (a, b) => expect([...a].sort()).toEqual([...b].sort());
const TEST_DIR = "zz-manage-test";

afterAll(() => {
  // Always clean the throwaway folder, even if a test failed mid-way.
  fsOp("delete", { root: "dynamic-prompts", path: TEST_DIR });
});

describe("buildManageSnapshot reproduces the engine catalog", () => {
  const snap = buildManageSnapshot();

  it("derives the same list names as the Node loader", () => {
    const listKeys = Object.keys(snap.lists);
    const groupKeys = Object.keys(snap.listGroups);
    const groupDirs = autoGroupListDirs(
      logicalListNames(listKeys),
      snap.listEnableGroupDirs,
      snap.listDisableGroupDirs,
    );
    const names = allListNames([...logicalListNames([...listKeys, ...groupKeys]), ...groupDirs]);
    sortEq(names, nodeLoader.listNames());
    sortEq(groupDirs, nodeLoader.groupListDirs());
    sortEq(snap.listForcePrefixDirs, nodeLoader.forcedPrefixDirs());
  });

  it("derives the same dynamic-prompt names as the Node loader", () => {
    const dplKeys = Object.keys(snap.dpDpl);
    const set = new Set(dplKeys);
    const dpNames = [...new Set([...dplKeys, ...snap.dpJsKeys.filter((k) => !set.has(k))])].sort(
      compareNames,
    );
    sortEq(dpNames, nodeLoader.dynamicPromptNames());
    sortEq(snap.dpForcePrefixDirs, nodeLoader.dynPromptForcedPrefixDirs());
  });

  it("today's catalog is all .dpl (no .js-only generators)", () => {
    expect(snap.dpJsKeys).toEqual([]);
  });
});

describe("write / sidecar / marker / move / delete round-trip", () => {
  it("creates a file that appears in the snapshot", () => {
    fsOp("mkfile", {
      root: "dynamic-prompts",
      path: `${TEST_DIR}/sample.dpl`,
      text: "T\n===\nx\n",
    });
    expect(`${TEST_DIR}/sample` in buildManageSnapshot().dpDpl).toBe(true);
  });

  it("merges and removes a sidecar", () => {
    mergeSidecar("dynamic-prompts", `${TEST_DIR}/sample`, { description: "hi", nsfw: true });
    let m = buildManageSnapshot().dpMeta[`${TEST_DIR}/sample`];
    expect(m).toMatchObject({ description: "hi", nsfw: true });
    mergeSidecar("dynamic-prompts", `${TEST_DIR}/sample`, { nsfw: null, description: null });
    expect(buildManageSnapshot().dpMeta[`${TEST_DIR}/sample`]).toBeUndefined();
  });

  it("toggles a folder marker", () => {
    setMarker("dynamic-prompts", TEST_DIR, "_force-prefix", true);
    expect(buildManageSnapshot().dpForcePrefixDirs).toContain(TEST_DIR);
    setMarker("dynamic-prompts", TEST_DIR, "_force-prefix", false);
    expect(buildManageSnapshot().dpForcePrefixDirs).not.toContain(TEST_DIR);
  });

  it("moves a file", () => {
    fsOp("move", {
      root: "dynamic-prompts",
      path: `${TEST_DIR}/sample.dpl`,
      to: `${TEST_DIR}/renamed.dpl`,
    });
    const snap = buildManageSnapshot();
    expect(`${TEST_DIR}/renamed` in snap.dpDpl).toBe(true);
    expect(`${TEST_DIR}/sample` in snap.dpDpl).toBe(false);
  });

  it("blocks path traversal", () => {
    expect(fsOp("mkfile", { root: "lists", path: "../../escape.txt", text: "x" }).ok).toBe(false);
  });

  it("deletes the throwaway folder", () => {
    fsOp("delete", { root: "dynamic-prompts", path: TEST_DIR });
    const snap = buildManageSnapshot();
    expect(Object.keys(snap.dpDpl).some((k) => k.startsWith(`${TEST_DIR}/`))).toBe(false);
  });
});

describe("ghost detection (manifest minus local)", () => {
  it("flags a file present upstream but missing locally", () => {
    const tree = buildManageTree(MANAGE_ROOTS.lists);
    // Manifest = the current BUILT-IN local set (so nothing is a ghost yet). Derived from the
    // built-in tree, not the snapshot: the snapshot now merges the user overlay too, and the real
    // ghost feature diffs against the upstream (data/) manifest, which never contains user content.
    const collect = (node, prefix = "") => {
      const out = [];
      for (const f of node.files)
        if (f.endsWith(".txt") || f.endsWith(".group")) {
          out.push(prefix ? `${prefix}/${f}` : f);
        }
      for (const d of node.dirs) out.push(...collect(d, prefix ? `${prefix}/${d.name}` : d.name));
      return out;
    };
    const listManifestPaths = collect(tree);
    expect(computeGhosts(tree, listManifestPaths, "lists", { includeAdult: true })).toHaveLength(0);

    // Drop a known file locally → it becomes a ghost.
    const look = tree.dirs.find((d) => d.name === "look");
    look.files = look.files.filter((f) => f !== "color.txt");
    const ghosts = computeGhosts(tree, listManifestPaths, "lists", { includeAdult: true });
    const color = ghosts.find((g) => g.path === "look/color");
    expect(color).toMatchObject({ ext: "txt", kind: "list", ghost: true });
  });

  it("builds a model with the expected top-level categories", () => {
    const tree = buildManageTree(MANAGE_ROOTS["dynamic-prompts"]);
    const model = buildManageModel(tree, "dynamic-prompts", { includeAdult: true });
    const cats = model.children.map((c) => c.name);
    expect(cats).toContain("scene");
    expect(cats).toContain("prompt");
  });
});

// The user overlay (user/lists, user/blocks). These write into throwaway paths under the real user
// roots, so they live in THIS file (not a parallel one) to stay serialized with the snapshot-vs-loader
// comparison above, which reads the shared user roots too.
describe("user overlay — user/ content merges into the pool (user-wins)", () => {
  const T = "zz-user-overlay-test";
  const OVERRIDE_KEY = "look/color"; // a real built-in list (data/lists/look/color.txt)

  afterEach(() => {
    fsOp("delete", { root: "user-lists", path: T });
    fsOp("delete", { root: "user-lists", path: "look" });
    fsOp("delete", { root: "user-blocks", path: T });
  });

  it("merges a new user list into the snapshot pool", () => {
    fsOp("mkfile", { root: "user-lists", path: `${T}/mine.txt`, text: "alpha\nbeta\n" });
    const snap = buildManageSnapshot();
    expect(`${T}/mine` in snap.lists).toBe(true);
    expect(snap.lists[`${T}/mine`]).toContain("alpha");
  });

  it("lets a user list override a built-in of the same name (user-wins)", () => {
    const builtIn = buildManageSnapshot().lists[OVERRIDE_KEY];
    expect(builtIn).toBeTypeOf("string"); // the built-in exists to be overridden
    fsOp("mkfile", { root: "user-lists", path: `${OVERRIDE_KEY}.txt`, text: "USER_ONLY_COLOR\n" });
    const overridden = buildManageSnapshot().lists[OVERRIDE_KEY];
    expect(overridden).toContain("USER_ONLY_COLOR");
    expect(overridden).not.toEqual(builtIn);
  });

  it("refuses to restore user content from the repo (no upstream default)", async () => {
    const r = await restoreFromRepo("user-lists", "look/color.txt");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no repository default/i);
  });
});
