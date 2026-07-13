/**
 * @file Phone-local storage for the mobile target — the counterpart to the desktop /api backend.
 * Images (generated) + their prompt metadata, and the user content overlay (custom word lists), live
 * under the app's document directory. Metadata lives in a single `index.json` keyed by image name (so
 * listing stays O(1) at the 100k max instead of reading a sidecar per image — the mobile equivalent of
 * the web's per-image `.json` sidecars the dev server reads). Web-safe: on react-native-web (headless
 * UI verification) there's no filesystem, so every call degrades to an in-memory no-op.
 */
import { Platform } from "react-native";

const FS = Platform.OS === "web" ? null : require("expo-file-system/legacy");

const ROOT = FS ? `${FS.documentDirectory}rap/` : null;
const IMAGES = ROOT ? `${ROOT}images/` : null;
const LISTS = ROOT ? `${ROOT}lists/` : null;
// The user content overlay's two roots on device — the RN counterpart to the web repo-root `user/lists`
// + `user/blocks`. Lists stay at the historical `rap/lists/` (back-compat); user blocks (generators)
// live at `rap/blocks/`. Both support nested folders + `.json` (description/nsfw) sidecars; blocks also
// support an optional `.js` sidecar, exactly like the web overlay.
const BLOCKS = ROOT ? `${ROOT}blocks/` : null;
const USER_ROOTS = { lists: { dir: LISTS, ext: "txt", kind: "list" }, blocks: { dir: BLOCKS, ext: "dpl", kind: "generator" } };
const INDEX = IMAGES ? `${IMAGES}index.json` : null;

export const storageAvailable = !!FS;

async function ensure(dir) {
  if (!FS) return;
  const info = await FS.getInfoAsync(dir);
  if (!info.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
}

async function readIndex() {
  if (!FS) return {};
  try {
    return JSON.parse(await FS.readAsStringAsync(INDEX));
  } catch {
    return {};
  }
}
async function writeIndex(idx) {
  if (!FS) return;
  await FS.writeAsStringAsync(INDEX, JSON.stringify(idx));
}
const nameOf = (uri) => uri.split("/").pop();

/**
 * @returns {Promise<Array<{name, uri, prompt?, provider?, model?, createdAt?}>>} Saved images, newest
 *   first (names embed the creation timestamp), each merged with its metadata from index.json.
 */
export async function listImages() {
  if (!FS) return [];
  await ensure(IMAGES);
  const [names, idx] = await Promise.all([FS.readDirectoryAsync(IMAGES), readIndex()]);
  return names
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n))
    .sort()
    .reverse()
    .map((n) => ({ name: n, uri: `${IMAGES}${n}`, ...(idx[n] || {}) }));
}

/**
 * Save a generated image into the gallery from any source a provider returns (`data:` base64 /
 * `https:` URL / local `file:`), recording its full prompt/settings metadata in index.json — the
 * mobile counterpart of the web's per-image `.json` sidecar. The rich fields (prompt layers,
 * negative, seed, size, settings snapshot, lineage) power the Single view's layered prompt cards,
 * details table, keyword cloud, and re-roll / variation lineage. Returns `{ name, uri }`.
 * @param {string} src
 * @param {{prompt?:string, negative?:string, layers?:object, negativeLayers?:object,
 *   provider?:string, providerLabel?:string, model?:string, seed?:(string|number),
 *   size?:string, settings?:object, keywords?:string[], parent?:string,
 *   derivedKind?:string, derivedSource?:string}} [meta]
 */
// legacy expo-file-system downloadAsync has no AbortSignal, so a stalled remote source would hang
// saveImageSrc forever. Race it against an app-level timeout that rejects with a clear error instead.
const REMOTE_DOWNLOAD_TIMEOUT_MS = 60_000;
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function saveImageSrc(src, meta = {}) {
  if (!FS) return null;
  await ensure(IMAGES);
  const name = `img-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`;
  const dest = `${IMAGES}${name}`;
  if (src.startsWith("data:")) {
    const base64 = src.slice(src.indexOf(",") + 1);
    await FS.writeAsStringAsync(dest, base64, { encoding: FS.EncodingType.Base64 });
  } else if (/^https?:/i.test(src)) {
    await withTimeout(FS.downloadAsync(src, dest), REMOTE_DOWNLOAD_TIMEOUT_MS, "Image download");
  } else {
    await FS.copyAsync({ from: src, to: dest });
  }
  const idx = await readIndex();
  idx[name] = {
    prompt: meta.prompt || "",
    negative: meta.negative || "",
    layers: meta.layers || null,
    negativeLayers: meta.negativeLayers || null,
    provider: meta.provider || "",
    providerLabel: meta.providerLabel || "",
    model: meta.model || "",
    seed: meta.seed ?? null,
    size: meta.size || "",
    settings: meta.settings || null,
    keywords: Array.isArray(meta.keywords) ? meta.keywords : null,
    parent: meta.parent || null,
    derivedKind: meta.derivedKind || null,
    derivedSource: meta.derivedSource || null,
    createdAt: Date.now(),
  };
  await writeIndex(idx);
  return { name, uri: dest };
}

/**
 * Merge a metadata patch into a saved image's index entry (e.g. saving an AI-rebuilt keyword list
 * from the Single view). Returns the merged entry, or null when unavailable.
 * @param {string} uri The image uri.
 * @param {object} patch The fields to merge.
 */
export async function updateImageMeta(uri, patch) {
  if (!FS) return null;
  const idx = await readIndex();
  const key = nameOf(uri);
  if (!idx[key]) return null;
  idx[key] = { ...idx[key], ...patch };
  await writeIndex(idx);
  return idx[key];
}

/** Copy an image (from a temp uri) into the gallery. */
export async function saveImageFromUri(srcUri, name) {
  if (!FS) return null;
  await ensure(IMAGES);
  const dest = `${IMAGES}${name}`;
  await FS.copyAsync({ from: srcUri, to: dest });
  return dest;
}

export async function deleteImage(uri) {
  if (!FS) return;
  await FS.deleteAsync(uri, { idempotent: true });
  const idx = await readIndex();
  if (idx[nameOf(uri)]) {
    delete idx[nameOf(uri)];
    await writeIndex(idx);
  }
}

/** Bulk-delete images (+ their metadata) — the gallery's multi-select delete. */
export async function deleteImages(uris) {
  if (!FS || !uris.length) return;
  const idx = await readIndex();
  for (const uri of uris) {
    await FS.deleteAsync(uri, { idempotent: true });
    delete idx[nameOf(uri)];
  }
  await writeIndex(idx);
}

/** @returns {Promise<string[]>} Names of the user's custom word lists (without .txt). */
export async function listUserLists() {
  if (!FS) return [];
  await ensure(LISTS);
  const names = await FS.readDirectoryAsync(LISTS);
  return names
    .filter((n) => n.endsWith(".txt"))
    .map((n) => n.replace(/\.txt$/, ""))
    .sort();
}

export async function readUserList(name) {
  if (!FS) return "";
  try {
    return await FS.readAsStringAsync(`${LISTS}${name}.txt`);
  } catch {
    return "";
  }
}

export async function writeUserList(name, text) {
  if (!FS) return;
  await ensure(LISTS);
  await FS.writeAsStringAsync(`${LISTS}${name}.txt`, text);
}

export async function deleteUserList(name) {
  if (!FS) return;
  await FS.deleteAsync(`${LISTS}${name}.txt`, { idempotent: true });
}

// ---------------------------------------------------------------------------------------------------
// Manage content overlay — the on-device counterpart to the web `user/lists` + `user/blocks`. Both roots
// support nested folders + `.json` (description/nsfw) sidecars; blocks add an optional `.js` sidecar.
// `root` is "lists" | "blocks". Paths are folder-relative keys WITHOUT extension (e.g. "scene/dawn").
// ---------------------------------------------------------------------------------------------------

const rootInfo = (root) => USER_ROOTS[root];
const entryPath = (root, key) => `${rootInfo(root).dir}${key}.${rootInfo(root).ext}`;
const sidePath = (root, key) => `${rootInfo(root).dir}${key}.json`;
const jsPath = (key) => `${BLOCKS}${key}.js`;
const parentDirOf = (abs) => abs.slice(0, abs.lastIndexOf("/") + 1);

// Ensure the parent directory of a nested key exists (folders can be several deep).
async function ensureParent(abs) {
  if (!FS) return;
  const dir = parentDirOf(abs);
  const info = await FS.getInfoAsync(dir);
  if (!info.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
}

// Depth-first walk of a directory tree. `readDirectoryAsync` is one level, so recurse, using
// `getInfoAsync().isDirectory` to tell folders from files. Returns folder + file keys relative to base.
async function walkDir(absDir, relBase = "") {
  const folders = [];
  const files = [];
  let names = [];
  try {
    names = await FS.readDirectoryAsync(absDir);
  } catch {
    return { folders, files };
  }
  for (const n of names) {
    const abs = `${absDir}${n}`;
    const rel = relBase ? `${relBase}/${n}` : n;
    let info;
    try {
      info = await FS.getInfoAsync(abs);
    } catch {
      continue;
    }
    if (info.isDirectory) {
      folders.push(rel);
      const sub = await walkDir(`${abs}/`, rel);
      folders.push(...sub.folders);
      files.push(...sub.files);
    } else {
      files.push(rel);
    }
  }
  return { folders, files };
}

/**
 * Build the nested folder tree of one user root, mirroring the web Manage tree model. Each folder node
 * is `{ name, path, folders:[…], entries:[…] }`; each entry is `{ key, label, kind, hasJs }` (kind:
 * "list" | "generator"). Sidecar (`.json`) and JS (`.js`) files are folded in, not listed as entries.
 * @param {("lists"|"blocks")} root
 * @returns {Promise<{name:string, path:string, folders:Array, entries:Array}>}
 */
export async function readUserTree(root) {
  const info = rootInfo(root);
  const rootNode = { name: root, path: "", folders: [], entries: [] };
  if (!FS || !info) return rootNode;
  await ensure(info.dir);
  const { folders, files } = await walkDir(info.dir);
  const nodes = new Map([["", rootNode]]);
  const ensureNode = (path) => {
    if (nodes.has(path)) return nodes.get(path);
    const name = path.slice(path.lastIndexOf("/") + 1);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const node = { name, path, folders: [], entries: [] };
    nodes.set(path, node);
    ensureNode(parent).folders.push(node);
    return node;
  };
  for (const f of folders.slice().sort()) ensureNode(f);
  const jsKeys = new Set(files.filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, "")));
  const ext = `.${info.ext}`;
  for (const f of files) {
    if (!f.endsWith(ext)) continue;
    const key = f.slice(0, -ext.length);
    const folder = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
    ensureNode(folder).entries.push({
      key,
      label: key.slice(key.lastIndexOf("/") + 1),
      kind: info.kind,
      hasJs: root === "blocks" && jsKeys.has(key),
    });
  }
  // Stable order: folders then entries, each alphabetized (mirrors the web tree).
  const sortNode = (n) => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name));
    n.entries.sort((a, b) => a.label.localeCompare(b.label));
    n.folders.forEach(sortNode);
  };
  sortNode(rootNode);
  return rootNode;
}

/** @returns {Promise<string[]>} All user block keys (nested, no ext), sorted. */
export async function listUserBlocks() {
  if (!FS) return [];
  await ensure(BLOCKS);
  const { files } = await walkDir(BLOCKS);
  return files
    .filter((f) => f.endsWith(".dpl"))
    .map((f) => f.replace(/\.dpl$/, ""))
    .sort();
}

/** Read a user block's `.dpl` source (""" when absent). */
export async function readUserBlock(key) {
  if (!FS) return "";
  try {
    return await FS.readAsStringAsync(entryPath("blocks", key));
  } catch {
    return "";
  }
}

/** Write a user block's `.dpl` source (creates parent folders). */
export async function writeUserBlock(key, text) {
  if (!FS) return;
  const abs = entryPath("blocks", key);
  await ensureParent(abs);
  await FS.writeAsStringAsync(abs, text);
}

/** Delete a user block and its `.js` / `.json` sidecars. */
export async function deleteUserBlock(key) {
  if (!FS) return;
  await FS.deleteAsync(entryPath("blocks", key), { idempotent: true });
  await FS.deleteAsync(jsPath(key), { idempotent: true });
  await FS.deleteAsync(sidePath("blocks", key), { idempotent: true });
}

/** Read a block's `.js` sidecar, or null when there is none. */
export async function readUserBlockJs(key) {
  if (!FS) return null;
  try {
    return await FS.readAsStringAsync(jsPath(key));
  } catch {
    return null;
  }
}

/** Write (or create) a block's `.js` sidecar. */
export async function writeUserBlockJs(key, text) {
  if (!FS) return;
  await ensureParent(jsPath(key));
  await FS.writeAsStringAsync(jsPath(key), text);
}

/** Read an entry's `.json` sidecar (description / nsfw), `{}` when absent. */
export async function readUserSidecar(root, key) {
  if (!FS) return {};
  try {
    return JSON.parse(await FS.readAsStringAsync(sidePath(root, key)));
  } catch {
    return {};
  }
}

/** Merge a patch into an entry's `.json` sidecar (null values are dropped; empty sidecar is removed). */
export async function writeUserSidecar(root, key, patch) {
  if (!FS) return;
  const cur = await readUserSidecar(root, key);
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") delete next[k];
    else next[k] = v;
  }
  const abs = sidePath(root, key);
  if (Object.keys(next).length === 0) {
    await FS.deleteAsync(abs, { idempotent: true });
  } else {
    await ensureParent(abs);
    await FS.writeAsStringAsync(abs, JSON.stringify(next));
  }
}

/** Create an (empty) folder under a user root. */
export async function makeUserFolder(root, path) {
  if (!FS) return;
  await FS.makeDirectoryAsync(`${rootInfo(root).dir}${path}`, { intermediates: true });
}

/** Recursively delete a folder (and everything under it) from a user root. */
export async function deleteUserFolder(root, path) {
  if (!FS) return;
  await FS.deleteAsync(`${rootInfo(root).dir}${path}`, { idempotent: true });
}

/** Move/rename an entry (and its `.js` / `.json` sidecars) within a user root. */
export async function moveUserEntry(root, fromKey, toKey) {
  if (!FS || fromKey === toKey) return;
  const move = async (from, to) => {
    const info = await FS.getInfoAsync(from);
    if (!info.exists) return;
    await ensureParent(to);
    await FS.copyAsync({ from, to });
    await FS.deleteAsync(from, { idempotent: true });
  };
  await move(entryPath(root, fromKey), entryPath(root, toKey));
  await move(sidePath(root, fromKey), sidePath(root, toKey));
  if (root === "blocks") await move(jsPath(fromKey), jsPath(toKey));
}
