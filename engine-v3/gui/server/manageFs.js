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

/**
 * Read-modify-write a `<name>.json` sidecar: merge `patch` (a key set to null is removed). When the
 * result is empty the sidecar file is deleted, so we never leave an empty `{}` behind.
 * @param {string} root `"lists"` or `"dynamic-prompts"`.
 * @param {string} name The logical key (e.g. "scene/castle" or a folder "fragment").
 * @param {object} patch Keys to merge (null deletes a key).
 * @returns {object|null} The merged sidecar (`{}` if it was deleted), or null on a bad path.
 */
export function mergeSidecar(root, name, patch) {
  const abs = resolveManagePath(root, `${name}.json`);
  if (!abs) return null;
  let cur = {};
  if (fs.existsSync(abs)) {
    try {
      cur = JSON.parse(fs.readFileSync(abs, "utf8")) || {};
    } catch {
      cur = {};
    }
  }
  const merged = { ...cur };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined) delete merged[k];
    else merged[k] = v;
  }
  if (Object.keys(merged).length === 0) {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    return {};
  }
  writeFileAtomic(abs, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

const MARKERS = new Set(["_force-prefix", "_enable-group-list", "_disable-group-list"]);

/**
 * Create or remove a folder `_`-marker (the abstracted force-prefix / group toggles).
 * @param {string} root `"lists"` or `"dynamic-prompts"`.
 * @param {string} dir The folder path ("" for the root).
 * @param {string} marker One of the allowed marker filenames.
 * @param {boolean} on Whether the marker should exist.
 * @returns {boolean} Success.
 */
export function setMarker(root, dir, marker, on) {
  if (!MARKERS.has(marker)) return false;
  const abs = resolveManagePath(root, dir ? `${dir}/${marker}` : marker);
  if (!abs) return false;
  if (on) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, "");
  } else if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
  return true;
}

// The stable branch the "restore default" action pulls original files from. `main` is the current
// stable release that carries the engine-v3/ layout; `master` is a stale old-layout branch and can't
// serve these paths (confirmed 2026-06-28 with the owner).
const RAW_BASE =
  "https://raw.githubusercontent.com/junebug12851/random-ai-prompt/main/engine-v3/data";

/**
 * Restore a file to its repository default (the stable `master` branch). Overwrites the local copy;
 * if the file no longer exists upstream (404) the local copy is deleted instead.
 * @param {string} root `"lists"` or `"dynamic-prompts"`.
 * @param {string} rel The relative path within the root (e.g. "place/city.txt").
 * @returns {Promise<{ok: boolean, deleted?: boolean, error?: string}>}
 */
export async function restoreFromRepo(root, rel) {
  const abs = resolveManagePath(root, rel);
  if (!abs) return { ok: false, error: "Invalid path" };
  const url = `${RAW_BASE}/${root}/${String(rel).split("\\").join("/")}`;
  try {
    const r = await fetch(url);
    if (r.status === 404) {
      fs.rmSync(abs, { force: true });
      return { ok: true, deleted: true };
    }
    if (!r.ok) return { ok: false, error: `Upstream returned ${r.status}` };
    writeFileAtomic(abs, await r.text());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Filesystem op on the content tree (create folder / create file / delete / move-or-rename). Each is
 * traversal-guarded to the data roots.
 * @param {string} op `"mkdir" | "mkfile" | "delete" | "move"`.
 * @param {object} args `{ root, path, to?, text? }`.
 * @returns {{ok: boolean, error?: string}}
 */
export function fsOp(op, args) {
  const { root, path: rel, to, text } = args || {};
  const abs = resolveManagePath(root, rel);
  if (!abs) return { ok: false, error: "Invalid path" };
  try {
    if (op === "mkdir") {
      fs.mkdirSync(abs, { recursive: true });
    } else if (op === "mkfile") {
      if (fs.existsSync(abs)) return { ok: false, error: "Already exists" };
      writeFileAtomic(abs, typeof text === "string" ? text : "");
    } else if (op === "delete") {
      fs.rmSync(abs, { recursive: true, force: true });
    } else if (op === "move") {
      const dest = resolveManagePath(root, to);
      if (!dest) return { ok: false, error: "Invalid destination" };
      if (fs.existsSync(dest)) return { ok: false, error: "Destination exists" };
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(abs, dest);
    } else {
      return { ok: false, error: `Unknown op: ${op}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
