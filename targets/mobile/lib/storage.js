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
