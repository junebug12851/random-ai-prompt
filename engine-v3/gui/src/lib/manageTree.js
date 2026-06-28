/**
 * Build the Manage tab's display model from the raw on-disk folder tree (`GET /api/manage/tree`).
 *
 * Manage shows the **real** folder structure — more than Generate's flattened palette — and makes
 * the engine's hidden mechanics legible: which folders are categories (top level) vs plain
 * subfolders, which are force-prefix or implied-group folders, and which entries are NSFW. The
 * semantics are computed with the same `listManifest` / `gatedLists` helpers the engine uses, so the
 * view never drifts from real behavior. `_`-marker files are abstracted into folder attributes (never
 * shown as files), and `.json` sidecars are hidden (surfaced through the folder/file editors).
 * @module gui/lib/manageTree
 */
import { autoGroupListDirs, logicalListNames } from "../../../src/listManifest.js";
import { hasNsfwToken } from "../../../src/gatedLists.js";

const MARKER_FILES = new Set(["_force-prefix", "_enable-group-list", "_disable-group-list"]);

/**
 * Classify a raw filename into a catalog entry, or null if it's internal/metadata/a `.js` sidecar.
 * @param {string} f The filename.
 * @param {boolean} isDp Whether this is the dynamic-prompts root.
 * @param {Set<string>} dplBases Basenames in this folder that have a `.dpl` (so a `.js` is a sidecar).
 * @returns {{base: string, label: string, kind: string, ext: string}|null}
 */
function classifyFile(f, isDp, dplBases) {
  if (f.startsWith("_") || f.endsWith(".json")) return null;
  if (isDp) {
    if (f.endsWith(".dpl")) return { base: f.slice(0, -4), label: f.slice(0, -4), kind: "generator", ext: "dpl" };
    if (f.endsWith(".js")) {
      const b = f.slice(0, -3);
      if (dplBases.has(b)) return null; // sidecar of a same-name .dpl
      return { base: b, label: b, kind: "generator", ext: "js" };
    }
    if (f.endsWith(".group")) return { base: f.slice(0, -6), label: f.slice(0, -6), kind: "group", ext: "group" };
    return null;
  }
  if (f.endsWith(".txt")) return { base: f.slice(0, -4), label: f.slice(0, -4), kind: "list", ext: "txt" };
  if (f.endsWith(".group")) return { base: f.slice(0, -6), label: f.slice(0, -6), kind: "group", ext: "group" };
  return null;
}

const dplBasesOf = (files) =>
  new Set(files.filter((f) => f.endsWith(".dpl")).map((f) => f.slice(0, -4)));

/**
 * Build the nested display model for one data root.
 * @param {{name: string, dirs: object[], files: string[]}} treeNode The raw root tree node.
 * @param {("lists"|"dynamic-prompts")} root Which root.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] When false, NSFW entries (and folders that empty out) are hidden.
 * @returns {object} The root display node (`children` = categories).
 */
export function buildManageModel(treeNode, root, opts = {}) {
  const includeAdult = opts.includeAdult === true;
  const isDp = root === "dynamic-prompts";

  // Pass 1: collect every entry's logical path + the marker folders, for group/force-prefix info.
  const entryPaths = [];
  const enableDirs = [];
  const disableDirs = [];
  const forceDirs = [];
  const walk1 = (node, prefix) => {
    if (node.files.includes("_force-prefix")) forceDirs.push(prefix);
    if (node.files.includes("_enable-group-list")) enableDirs.push(prefix);
    if (node.files.includes("_disable-group-list")) disableDirs.push(prefix);
    const dplBases = dplBasesOf(node.files);
    for (const f of node.files) {
      const ent = classifyFile(f, isDp, dplBases);
      if (ent) entryPaths.push(prefix ? `${prefix}/${ent.base}` : ent.base);
    }
    for (const d of node.dirs) walk1(d, prefix ? `${prefix}/${d.name}` : d.name);
  };
  walk1(treeNode, "");

  const groupDirs = new Set(
    autoGroupListDirs(isDp ? entryPaths : logicalListNames(entryPaths), enableDirs, disableDirs),
  );
  const forceSet = new Set(forceDirs);
  const enableSet = new Set(enableDirs);
  const disableSet = new Set(disableDirs);

  // Pass 2: build the nested model, hiding NSFW when adult is off.
  const build = (node, prefix, depth) => {
    const dplBases = dplBasesOf(node.files);
    const entries = [];
    for (const f of node.files) {
      const ent = classifyFile(f, isDp, dplBases);
      if (!ent) continue;
      const path = prefix ? `${prefix}/${ent.base}` : ent.base;
      const nsfw = hasNsfwToken(ent.base) || hasNsfwToken(path);
      if (nsfw && !includeAdult) continue;
      const hasJsSidecar = ent.ext === "dpl" && node.files.includes(`${ent.base}.js`);
      entries.push({ ...ent, path, root, nsfw, hasJsSidecar });
    }
    entries.sort((a, b) => a.label.localeCompare(b.label));

    const children = node.dirs
      .map((d) => build(d, prefix ? `${prefix}/${d.name}` : d.name, depth + 1))
      .filter((c) => includeAdult || c.entryCount > 0 || c.markers.length > 0);

    const markers = [];
    if (forceSet.has(prefix)) markers.push("force-prefix");
    if (groupDirs.has(prefix)) markers.push("group");

    const entryCount = entries.length + children.reduce((n, c) => n + c.entryCount, 0);
    return {
      name: node.name,
      path: prefix,
      root,
      depth,
      isCategory: depth === 1,
      isGroup: groupDirs.has(prefix),
      forcePrefix: forceSet.has(prefix),
      enableGroup: enableSet.has(prefix),
      disableGroup: disableSet.has(prefix),
      markers,
      entries,
      children,
      entryCount,
    };
  };

  return build(treeNode, "", 0);
}

/** Collect every local entry file path (root-relative, with extension) from a raw tree node. */
function localFileSet(treeNode) {
  const set = new Set();
  const walk = (node, prefix) => {
    for (const f of node.files) set.add(prefix ? `${prefix}/${f}` : f);
    for (const d of node.dirs) walk(d, prefix ? `${prefix}/${d.name}` : d.name);
  };
  walk(treeNode, "");
  return set;
}

/**
 * Compute "ghost" entries: files that exist on the stable branch (the manifest) but are missing
 * locally (you deleted them) — restorable. Only entry files count (`.txt`/`.group` for lists,
 * `.dpl` for generators); sidecars/markers/`.js` aren't shown as pills. NSFW ghosts are hidden when
 * adult is off.
 * @param {{name: string, dirs: object[], files: string[]}} treeNode The local raw tree for the root.
 * @param {string[]} manifestPaths The stable-branch file paths for this root (with extension).
 * @param {("lists"|"dynamic-prompts")} root Which root.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] Show NSFW ghosts.
 * @returns {object[]} Ghost entry objects (`{ root, path, ext, kind, label, nsfw, ghost: true }`).
 */
export function computeGhosts(treeNode, manifestPaths, root, opts = {}) {
  const includeAdult = opts.includeAdult === true;
  const isDp = root === "dynamic-prompts";
  const local = localFileSet(treeNode);
  const wanted = isDp ? [".dpl"] : [".txt", ".group"];
  const ghosts = [];
  for (const p of manifestPaths || []) {
    const ext = wanted.find((e) => p.endsWith(e));
    if (!ext) continue;
    if (local.has(p)) continue; // present locally — not a ghost
    const base = p.slice(0, -ext.length);
    if (base.split("/").pop().startsWith("_")) continue;
    const nsfw = hasNsfwToken(base);
    if (nsfw && !includeAdult) continue;
    const e = ext.slice(1);
    ghosts.push({
      root,
      path: base,
      ext: e,
      kind: isDp ? "generator" : e === "group" ? "group" : "list",
      label: base.split("/").pop(),
      nsfw,
      ghost: true,
    });
  }
  return ghosts;
}

const recount = (node) => {
  node.entryCount =
    node.entries.length + node.children.reduce((n, c) => n + recount(c), 0);
  return node.entryCount;
};

/**
 * Inject ghost entries into a built model, creating folder nodes for any folder that was wholly
 * deleted. Mutates and returns the root node.
 * @param {object} rootNode The model root node.
 * @param {object[]} ghosts Ghost entries from {@link computeGhosts}.
 * @returns {object} The root node.
 */
export function injectGhosts(rootNode, ghosts) {
  for (const g of ghosts) {
    const segs = g.path.split("/");
    const folders = segs.slice(0, -1);
    let node = rootNode;
    let prefix = "";
    for (let d = 0; d < folders.length; d++) {
      prefix = prefix ? `${prefix}/${folders[d]}` : folders[d];
      let child = node.children.find((c) => c.name === folders[d]);
      if (!child) {
        child = {
          name: folders[d],
          path: prefix,
          root: g.root,
          depth: d + 1,
          isCategory: d === 0,
          isGroup: false,
          forcePrefix: false,
          enableGroup: false,
          disableGroup: false,
          markers: [],
          entries: [],
          children: [],
          entryCount: 0,
          ghostFolder: true,
        };
        node.children.push(child);
        node.children.sort((a, b) => a.name.localeCompare(b.name));
      }
      node = child;
    }
    if (!node.entries.some((e) => e.path === g.path)) node.entries.push(g);
    node.entries.sort((a, b) => a.label.localeCompare(b.label));
  }
  if (ghosts.length) recount(rootNode);
  return rootNode;
}

/**
 * Filter a model node to entries/folders matching a lowercased query (keeps a folder if it or any
 * descendant matches). Returns null when nothing matches.
 * @param {object} node A model node.
 * @param {string} q Lowercased query.
 * @returns {object|null} The filtered node, or null.
 */
export function filterModel(node, q) {
  if (!q) return node;
  const entries = node.entries.filter((e) => e.label.toLowerCase().includes(q));
  const children = node.children.map((c) => filterModel(c, q)).filter(Boolean);
  const selfMatch = node.name.toLowerCase().includes(q);
  if (!selfMatch && entries.length === 0 && children.length === 0) return null;
  // A folder that matches by name keeps all its entries; otherwise just the matching ones.
  return { ...node, entries: selfMatch ? node.entries : entries, children };
}
