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
