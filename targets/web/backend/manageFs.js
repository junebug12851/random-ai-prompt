/**
 * Filesystem helpers for the local-mode content-management API (`/api/manage/*`).
 *
 * Extracted from the Vite middleware so the same code backs a production local/desktop build and so
 * it's unit-testable in plain Node (the runtime loader that consumes the snapshot needs Vite, but
 * these pure fs functions don't). Everything is scoped to the two prompt-content roots under
 * `data/` and traversal-guarded.
 * @module gui/server/manageFs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// data/{lists,blocks} — this file lives at gui/server/, so ../../../engine/data/ is the repo-root data dir.
const DATA_ROOT = fileURLToPath(new URL("../../../engine/data/", import.meta.url));
// The user overlay lives at the repo root under user/ (user/lists, user/blocks). Kept as SEPARATE
// Manage roots so the tab can group user content on top and route edits into user/, while the runtime
// SNAPSHOT (buildManageSnapshot) merges each user root onto its built-in pool with user-wins.
const USER_ROOT = fileURLToPath(new URL("../../../user/", import.meta.url));

/** The editable content roots, by name (built-ins + the user overlay). */
export const MANAGE_ROOTS = {
  lists: path.join(DATA_ROOT, "lists"),
  "blocks": path.join(DATA_ROOT, "blocks"),
  "user-lists": path.join(USER_ROOT, "lists"),
  "user-blocks": path.join(USER_ROOT, "blocks"),
};

/** The list-pool roots in precedence order (built-in first, user last → user overrides). */
const LIST_POOL_ROOTS = [MANAGE_ROOTS.lists, MANAGE_ROOTS["user-lists"]];
/** The block ("blocks") pool roots in precedence order (built-in first, user last). */
const DP_POOL_ROOTS = [MANAGE_ROOTS["blocks"], MANAGE_ROOTS["user-blocks"]];
/** Which Manage roots are the user overlay (no upstream default / ghost restore). */
export const USER_MANAGE_ROOTS = new Set(["user-lists", "user-blocks"]);

/**
 * Resolve a `{ root, path }` request to a safe absolute file under one of the data roots. Rejects
 * unknown roots and any path that escapes its root (traversal guard).
 * @param {string} root `"lists"` or `"blocks"`.
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
 *
 * By default the user overlay (`user/lists`, `user/blocks`) is merged onto the built-in pools with
 * user-wins — that's what the live runtime engine reads. Pass `{ includeUser: false }` for a
 * BUILT-IN-ONLY snapshot (used by the published `data/manifest.json` for ghost detection, which must
 * describe the upstream `data/` catalog and never conflate user content).
 * @param {object} [opts]
 * @param {boolean} [opts.includeUser=true] Merge the user overlay onto the built-in pools.
 * @returns {object} The snapshot.
 */
export function buildManageSnapshot(opts = {}) {
  const includeUser = opts.includeUser !== false;
  const listRoots = includeUser ? LIST_POOL_ROOTS : [MANAGE_ROOTS.lists];
  const dpRoots = includeUser ? DP_POOL_ROOTS : [MANAGE_ROOTS["blocks"]];
  const lists = {};
  const listGroups = {};
  const listMeta = {};
  const listForcePrefixDirs = [];
  const listEnableGroupDirs = [];
  const listDisableGroupDirs = [];
  // Built-in root first, then the user overlay — so a user file of the same key overwrites the
  // built-in in every map (user-wins). This is what makes the live runtime engine honor the overlay.
  for (const f of listRoots.flatMap(walkManageFiles)) {
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
  for (const f of dpRoots.flatMap(walkManageFiles)) {
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

  const uniq = (a) => [...new Set(a)];
  return {
    lists,
    listGroups,
    listMeta,
    listForcePrefixDirs: uniq(listForcePrefixDirs),
    listEnableGroupDirs: uniq(listEnableGroupDirs),
    listDisableGroupDirs: uniq(listDisableGroupDirs),
    dpDpl,
    dpMeta,
    dpGroups,
    dpJsKeys,
    dpForcePrefixDirs: uniq(dpForcePrefixDirs),
    dpEnableGroupDirs: uniq(dpEnableGroupDirs),
    dpDisableGroupDirs: uniq(dpDisableGroupDirs),
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
 * @param {string} root `"lists"` or `"blocks"`.
 * @param {string} name The logical key (e.g. "scene/castle" or a folder "fragment").
 * @param {object} patch Keys to merge (null deletes a key).
 * @returns {object|null} The merged sidecar (`{}` if it was deleted), or null on a bad path.
 */
export function mergeSidecar(root, name, patch) {
  const abs = resolveManagePath(root, `${name}.json`);
  if (!abs) return null;
  // Read it; don't ask whether it exists and THEN read it (check-then-use race, CodeQL
  // js/file-system-race). A missing sidecar just means "no sidecar yet".
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(abs, "utf8")) || {};
  } catch {
    cur = {}; // missing or corrupt — either way we start from nothing
  }

  const merged = { ...cur };
  for (const [k, v] of Object.entries(patch || {})) {
    // The patch comes off an HTTP request, so its KEYS are attacker-chosen. `merged["__proto__"] = v`
    // on a plain object mutates the prototype — every object in the process suddenly grows a property
    // (CodeQL js/remote-property-injection, high). These three keys are never legitimate sidecar
    // fields, so drop them rather than trying to be clever.
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (v === null || v === undefined) delete merged[k];
    else merged[k] = v;
  }

  if (Object.keys(merged).length === 0) {
    try {
      fs.unlinkSync(abs); // an empty sidecar is no sidecar; deleting one that's already gone is fine
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return {};
  }
  writeFileAtomic(abs, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

const MARKERS = new Set(["_force-prefix", "_enable-group-list", "_disable-group-list"]);

/**
 * Create or remove a folder `_`-marker (the abstracted force-prefix / group toggles).
 * @param {string} root `"lists"` or `"blocks"`.
 * @param {string} dir The folder path ("" for the root).
 * @param {string} marker One of the allowed marker filenames.
 * @param {boolean} on Whether the marker should exist.
 * @returns {boolean} Success.
 */
export function setMarker(root, dir, marker, on) {
  if (!MARKERS.has(marker)) return false;
  const abs = resolveManagePath(root, dir ? `${dir}/${marker}` : marker);
  if (!abs) return false;
  // Do it, don't check-then-do it (CodeQL js/file-system-race). `wx` fails if it already exists, which
  // is exactly the condition the old `existsSync` was testing for — only without the window in between.
  if (on) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    try {
      fs.writeFileSync(abs, "", { flag: "wx" });
    } catch (e) {
      if (e.code !== "EEXIST") throw e; // already there = already on
    }
  } else {
    try {
      fs.unlinkSync(abs);
    } catch (e) {
      if (e.code !== "ENOENT") throw e; // already gone = already off
    }
  }
  return true;
}

// The stable branch the "restore default" action pulls original files from. `main` is the current
// stable release, which carries the flat repo-root layout (`data/` at the top level).
const STABLE_BRANCH = "main";
const REPO = "1fairyfox/random-ai-prompt";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${STABLE_BRANCH}/data`;

let manifestCache = null;
let manifestAt = 0;

// On-disk cache so the manifest is fetched at most ~once a day (no rate limits, works offline after
// the first fetch). The filename carries a hash of repo@branch so different targets don't collide.
//
// NOT in `os.tmpdir()` any more (CodeQL `js/insecure-temporary-file`, high). The system temp dir is
// WORLD-WRITABLE and this filename is entirely predictable, so any other local account could pre-create
// it — or symlink it somewhere interesting — and we'd happily write through it and then trust what we
// read back. The app already owns a directory; keep app state in it. Written 0600 for good measure.
const MANIFEST_TTL = 24 * 60 * 60 * 1000;
const CACHE_DIR = path.join(USER_ROOT, ".cache");
const MANIFEST_CACHE_FILE = path.join(
  CACHE_DIR,
  `manifest-${crypto.createHash("sha1").update(`${REPO}@${STABLE_BRANCH}`).digest("hex").slice(0, 12)}.json`,
);

/**
 * Reduce whatever came back from the network to the ONLY shape this code understands: two arrays of
 * plain strings. Anything else — extra keys, nested objects, numbers, a `__proto__` — is dropped.
 *
 * This is also what gets cached to disk (CodeQL `js/http-to-file-access`: "network data written to
 * file"). Writing the raw response would mean the next boot parses attacker-influenced JSON straight
 * off our own disk and trusts it a little more for having been there. So the cache stores the
 * *normalized* value: what we persist is what we already validated.
 */
const normalizeManifest = (d) => {
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return { lists: strings(d?.lists), blocks: strings(d?.blocks) };
};

/**
 * The set of content files that exist on the stable branch, by root — used to surface "ghost"
 * entries (files deleted locally but still available upstream, restorable). Reads a **published
 * static manifest** (`data/manifest.json`, regenerated at release by `scripts/build-data-manifest.mjs`),
 * so there's no GitHub-API rate limit — just one fetch, **disk-cached for a day** in the OS temp dir
 * (checked on boot, re-downloaded at most ~once/day; falls back to the stale cache when offline). The
 * client then does a simple set difference. Paths are root-relative with extension.
 * @param {boolean} [fresh] Bypass the in-memory + disk cache and re-download now.
 * @returns {Promise<{lists: string[], "blocks": string[]}>}
 */
export async function remoteManifest(fresh = false) {
  if (!fresh && manifestCache && Date.now() - manifestAt < 5 * 60 * 1000) return manifestCache;

  // Disk cache: use it when it's younger than a day (the "quick check on boot" path — no network).
  if (!fresh) {
    try {
      const st = fs.statSync(MANIFEST_CACHE_FILE);
      if (Date.now() - st.mtimeMs < MANIFEST_TTL) {
        const cached = normalizeManifest(JSON.parse(fs.readFileSync(MANIFEST_CACHE_FILE, "utf8")));
        manifestCache = cached;
        manifestAt = Date.now();
        return cached;
      }
    } catch {
      /* no/old cache — fall through to fetch */
    }
  }

  try {
    const r = await fetch(`${RAW_BASE}/manifest.json`);
    if (!r.ok) throw new Error(`manifest returned ${r.status}`);
    const data = await r.json();
    // Normalize FIRST, then cache the normalized value — never the raw network payload (see
    // normalizeManifest). What we persist is what we already validated.
    const out = normalizeManifest(data);
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(MANIFEST_CACHE_FILE, JSON.stringify(out), { mode: 0o600 });
    } catch {
      /* cache write is best-effort */
    }
    manifestCache = out;
    manifestAt = Date.now();
    return out;
  } catch (e) {
    // Offline / fetch failed: fall back to the stale disk cache if we have one.
    try {
      const cached = normalizeManifest(JSON.parse(fs.readFileSync(MANIFEST_CACHE_FILE, "utf8")));
      manifestCache = cached;
      manifestAt = Date.now();
      return cached;
    } catch {
      throw e;
    }
  }
}

/**
 * Restore a file to its repository default (the stable `master` branch). Overwrites the local copy;
 * if the file no longer exists upstream (404) the local copy is deleted instead.
 * @param {string} root `"lists"` or `"blocks"`.
 * @param {string} rel The relative path within the root (e.g. "place/city.txt").
 * @returns {Promise<{ok: boolean, deleted?: boolean, error?: string}>}
 */
export async function restoreFromRepo(root, rel) {
  // User-overlay content has no upstream default. Never route it through the raw-URL restore (a 404
  // there DELETES the local file) — reject up front so a user's file can't be wiped.
  if (USER_MANAGE_ROOTS.has(root)) {
    return { ok: false, error: "User content has no repository default" };
  }
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
 * Filesystem op on the content tree (create folder / create file / delete / move-or-rename / copy).
 * Each is traversal-guarded to the data roots. `copy` may target a DIFFERENT root via `toRoot` (used
 * to override a built-in into the user overlay); `move` stays within `root`.
 * @param {string} op `"mkdir" | "mkfile" | "delete" | "move" | "copy"`.
 * @param {object} args `{ root, path, to?, toRoot?, text? }`.
 * @returns {{ok: boolean, error?: string}}
 */
export function fsOp(op, args) {
  const { root, path: rel, to, toRoot, text } = args || {};
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
    } else if (op === "copy") {
      // Copy a single file, optionally into another root (traversal-guarded on both ends). Refuses to
      // clobber an existing destination so an override can't silently overwrite a user's edited copy.
      const dest = resolveManagePath(toRoot || root, to);
      if (!dest) return { ok: false, error: "Invalid destination" };
      if (!fs.existsSync(abs)) return { ok: false, error: "Source missing" };
      if (fs.existsSync(dest)) return { ok: false, error: "Destination exists" };
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    } else {
      return { ok: false, error: `Unknown op: ${op}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
