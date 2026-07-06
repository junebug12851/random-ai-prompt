/**
 * @file Contract tests for the Manage tab's local-mode backend (`targets/web/backend/manageFs.js`) and the
 * tree/ghost model (`targets/web/frontend/lib/manageTree.js`). Verifies the disk snapshot reproduces the engine's
 * own catalog, the write/sidecar/marker/move/delete ops round-trip through the snapshot (in an
 * isolated throwaway folder), the traversal guard holds, and ghost detection is exact.
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  buildManageSnapshot,
  buildManageTree,
  mergeSidecar,
  setMarker,
  fsOp,
  restoreFromRepo,
  MANAGE_ROOTS,
} from "../../targets/web/backend/manageFs.js";
import { computeGhosts, buildManageModel } from "../../targets/web/frontend/lib/manageTree.js";
import { nodeLoader } from "../../engine/core/nodeLoader.js";
import {
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  compareNames,
} from "../../engine/listManifest.js";

const sortEq = (a, b) => expect([...a].sort()).toEqual([...b].sort());
const TEST_DIR = "zz-manage-test";

afterAll(() => {
  // Always clean the throwaway folder, even if a test failed mid-way.
  fsOp("delete", { root: "blocks", path: TEST_DIR });
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

  it("derives the same block names as the Node loader", () => {
    const dplKeys = Object.keys(snap.dpDpl);
    const set = new Set(dplKeys);
    const dpNames = [...new Set([...dplKeys, ...snap.dpJsKeys.filter((k) => !set.has(k))])].sort(
      compareNames,
    );
    sortEq(dpNames, nodeLoader.blockNames());
    sortEq(snap.dpForcePrefixDirs, nodeLoader.blockForcedPrefixDirs());
  });

  it("today's catalog is all .dpl (no .js-only generators)", () => {
    expect(snap.dpJsKeys).toEqual([]);
  });
});

describe("write / sidecar / marker / move / delete round-trip", () => {
  it("creates a file that appears in the snapshot", () => {
    fsOp("mkfile", {
      root: "blocks",
      path: `${TEST_DIR}/sample.dpl`,
      text: "T\n===\nx\n",
    });
    expect(`${TEST_DIR}/sample` in buildManageSnapshot().dpDpl).toBe(true);
  });

  it("merges and removes a sidecar", () => {
    mergeSidecar("blocks", `${TEST_DIR}/sample`, { description: "hi", nsfw: true });
    let m = buildManageSnapshot().dpMeta[`${TEST_DIR}/sample`];
    expect(m).toMatchObject({ description: "hi", nsfw: true });
    mergeSidecar("blocks", `${TEST_DIR}/sample`, { nsfw: null, description: null });
    expect(buildManageSnapshot().dpMeta[`${TEST_DIR}/sample`]).toBeUndefined();
  });

  it("toggles a folder marker", () => {
    setMarker("blocks", TEST_DIR, "_force-prefix", true);
    expect(buildManageSnapshot().dpForcePrefixDirs).toContain(TEST_DIR);
    setMarker("blocks", TEST_DIR, "_force-prefix", false);
    expect(buildManageSnapshot().dpForcePrefixDirs).not.toContain(TEST_DIR);
  });

  it("moves a file", () => {
    fsOp("move", {
      root: "blocks",
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
    fsOp("delete", { root: "blocks", path: TEST_DIR });
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
    const tree = buildManageTree(MANAGE_ROOTS["blocks"]);
    const model = buildManageModel(tree, "blocks", { includeAdult: true });
    const cats = model.children.map((c) => c.name);
    expect(cats).toContain("scene");
    expect(cats).toContain("prompt");
  });
});

// The user overlay (user/lists, user/blocks). Asserted STATICALLY against the committed community
// block `user/blocks/user/beach-merk.dpl` (key `user/beach-merk`) — no filesystem mutation, so these
// can't race with the deterministic snapshot/engine tests that run in parallel and read the shared
// catalog (the `keyword` wildcard unions the whole vocabulary, so even a transient extra list would
// perturb their output).
describe("user overlay — user/ content merges into the pool", () => {
  it("merges the committed user block (Merk's beach) into the default snapshot pool", () => {
    expect("user/beach-merk" in buildManageSnapshot().dpDpl).toBe(true);
  });

  it("the built-in-only snapshot EXCLUDES user content (what the upstream ghost manifest uses)", () => {
    const builtIn = buildManageSnapshot({ includeUser: false });
    expect("user/beach-merk" in builtIn.dpDpl).toBe(false); // user content never in the manifest
    expect("scene/beach" in builtIn.dpDpl).toBe(true); // the built-in scene is still there
  });

  it("the Node engine loader resolves the user block", () => {
    expect(nodeLoader.blockNames()).toContain("user/beach-merk");
    const mod = nodeLoader.loadBlock("user/beach-merk");
    expect(typeof mod.default).toBe("function");
  });

  it("refuses to restore user content from the repo (no upstream default)", async () => {
    const r = await restoreFromRepo("user-blocks", "user/beach-merk.dpl");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no repository default/i);
  });
});
