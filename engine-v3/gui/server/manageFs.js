/**
 * Filesystem helpers for the local-mode content-management API (`/api/manage/*`).
 *
 * Extracted from the Vite middleware so the same code backs a production local/desktop build and so
 * it's unit-testable in plain Node (the runtime loader that consumes the snapshot needs Vite, but
 * these pure fs functions don't). Everything is scoped to the two prompt-content roots under
 * `engine-v3/data/` and traversal-guarded.
 * @module gui/server/manageFs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// engine-v3/data/{lists,dynamic-prompts} — this file lives at engine-v3/gui/server/.
const DATA_ROOT = fileURLToPath(new URL("../../data/", import.meta.url));

/** The two editable content roots, by name. */
export const MANAGE_ROOTS = {
  lists: path.join(DATA_ROOT, "lists"),
  "dynamic-prompts": path.join(DATA_ROOT, "dynamic-prompts"),
};

/**
 * Resolve a `{ root, path }` request to a safe absolute file under one of the data roots. Rejects
 * unknown roots and any path that escapes its root (traversal guard).
 * @param {string} root `"lists"` or `"dynamic-prompts"`.
 * @param {string} rel The relative path within the root.
 * @returns {string|null} The absolute path, or null if invalid.
 */
export function resolveManagePath(root, rel) {
  const base = MANAGE_ROOTS[root];
  if (!base || typeof rel !== "string" || rel === "") return null;
  const abs = path.resolve(base, rel);
  const within = path.relative(base, abs);
  if (within === "" || within.startsWith("..") || path.isAbsolute(within)) return null;
  return abs;
}

/**
 * Recursively list every file under `root` as `{ abs, name, relDir }` (relDir is "/"-joined).
 * @param {string} root The absolute root.
 * @returns {Array<{abs: string, name: string, relDir: string}>}
 */
export function walkManageFiles(root) {
  const out = [];
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else out.push({ abs: path.join(dir, e.name), name: e.name, relDir: prefix.replace(/\/$/, "") });
    }
  };
  walk(root, "");
  return out;
}

const readTextSafe = (abs) => {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return "";
  }
};
const readJsonSafe = (abs) => {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
};

/**
 * Build the full disk snapshot the runtime loader serves the catalog from: every list / `.dpl` /
 * group / sidecar text, the `_`-marker folders, and the set of `.js`-module generator keys.
 * @returns {object} The snapshot.
 */
export function buildManageSnapshot() {
  const lists = {};
  const listGroups = {};
  const listMeta = {};
  const listForcePrefixDirs = [];
  const listEnableGroupDirs = [];
  const listDisableGroupDirs = [];
  for (const f of walkManageFiles(MANAGE_ROOTS.lists)) {
    if (f.name === "_force-prefix") {
      listForcePrefixDirs.push(f.relDir);
      continue;
    }
    if (f.name === "_enable-group-list") {
      listEnableGroupDirs.push(f.relDir);
      continue;
    }
    if (f.name === "_disable-group-list") {
      listDisableGroupDirs.push(f.relDir);
      continue;
    }
    const baseNoExt = f.name.replace(/\.[^.]+$/, "");
    if (baseNoExt.startsWith("_")) continue; // other internal files
    const key = (f.relDir ? `${f.relDir}/` : "") + baseNoExt;
    if (f.name.endsWith(".txt")) lists[key] = readTextSafe(f.abs);
    else if (f.name.endsWith(".group")) listGroups[key] = readTextSafe(f.abs);
    else if (f.name.endsWith(".json")) {
      const obj = readJsonSafe(f.abs);
      if (obj) listMeta[key] = obj;
    }
  }

  const dpDpl = {};
  const dpMeta = {};
  const dpGroups = {};
  const dpJs = new Set();
  const dpForcePrefixDirs = [];
  const dpEnableGroupDirs = [];
  const dpDisableGroupDirs = [];
  for (const f of walkManageFiles(MANAGE_ROOTS["dynamic-prompts"])) {
    if (f.name === "_force-prefix") {
      dpForcePrefixDirs.push(f.relDir);
      continue;
    }
    if (f.name === "_enable-group-list") {
      dpEnableGroupDirs.push(f.relDir);
      continue;
    }
    if (f.name === "_disable-group-list") {
      dpDisableGroupDirs.push(f.relDir);
      continue;
    }
    const baseNoExt = f.name.replace(/\.[^.]+$/, "");
    if (baseNoExt.startsWith("_")) continue;
    const key = (f.relDir ? `${f.relDir}/` : "") + baseNoExt;
    if (f.name.endsWith(".dpl")) dpDpl[key] = readTextSafe(f.abs);
    else if (f.name.endsWith(".js")) dpJs.add(key);
    else if (f.name.endsWith(".group")) dpGroups[key] = readTextSafe(f.abs);
    else if (f.name.endsWith(".json")) {
      const obj = readJsonSafe(f.abs);
      if (obj) dpMeta[key] = obj;
    }
  }
  // A `.js` is a generator only when there's no same-name `.dpl` (otherwise it's that .dpl's sidecar).
  const dpJsKeys = [...dpJs].filter((k) => !(k in dpDpl));

  return {
    lists,
    listGroups,
    listMeta,
    listForcePrefixDirs,
    listEnableGroupDirs,
    listDisableGroupDirs,
    dpDpl,
    dpMeta,
    dpGroups,
    dpJsKeys,
    dpForcePrefixDirs,
    dpEnableGroupDirs,
    dpDisableGroupDirs,
  };
}

/**
 * Build the raw folder tree of a data root for the Manage left panel: nested nodes with files
 * (including `_`-markers and `.json` sidecars) so the UI can show the real structure.
 * @param {string} root The absolute root.
 * @returns {{name: string, dirs: object[], files: string[]}} The tree node.
 */
export function buildManageTree(root) {
  const build = (dir, name) => {
    const n = { name, dirs: [], files: [] };
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return n;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) n.dirs.push(build(path.join(dir, e.name), e.name));
      else n.files.push(e.name);
    }
    return n;
  };
  return build(root, "");
}

/**
 * Write `text` to `abs` atomically (temp + rename), creating parent dirs.
 * @param {string} abs The absolute file path.
 * @param {string} text The contents.
 * @returns {void}
 */
export function writeFileAtomic(abs, text) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, abs);
}
