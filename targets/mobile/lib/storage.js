/**
 * @file Phone-local storage for the mobile target — the counterpart to the desktop /api backend.
 * Images (generated + derived) and the user content overlay (custom word lists) live under the app's
 * document directory. Web-safe: on react-native-web (used for headless UI verification) there's no
 * filesystem, so every call degrades to an in-memory no-op and screens still render.
 */
import { Platform } from "react-native";

// Legacy functional API (stable in SDK 54; the new File/Directory API is object-oriented).
const FS = Platform.OS === "web" ? null : require("expo-file-system/legacy");

const ROOT = FS ? `${FS.documentDirectory}rap/` : null;
const IMAGES = ROOT ? `${ROOT}images/` : null;
const LISTS = ROOT ? `${ROOT}lists/` : null;

export const storageAvailable = !!FS;

async function ensure(dir) {
  if (!FS) return;
  const info = await FS.getInfoAsync(dir);
  if (!info.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
}

/** @returns {Promise<Array<{name:string, uri:string}>>} Saved images, newest first by name. */
export async function listImages() {
  if (!FS) return [];
  await ensure(IMAGES);
  const names = await FS.readDirectoryAsync(IMAGES);
  return names
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n))
    .sort()
    .reverse()
    .map((n) => ({ name: n, uri: `${IMAGES}${n}` }));
}

/**
 * Save a generated image into the gallery from any source a provider returns: a `data:` base64 URL
 * (OpenAI / Stability / Gemini), an `https:` URL (fal / Leonardo), or a local `file:` uri. Picks a
 * unique name and returns `{ name, uri }`.
 */
export async function saveImageSrc(src) {
  if (!FS) return null;
  await ensure(IMAGES);
  const name = `img-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`;
  const dest = `${IMAGES}${name}`;
  if (src.startsWith("data:")) {
    const base64 = src.slice(src.indexOf(",") + 1);
    await FS.writeAsStringAsync(dest, base64, { encoding: FS.EncodingType.Base64 });
  } else if (/^https?:/i.test(src)) {
    await FS.downloadAsync(src, dest);
  } else {
    await FS.copyAsync({ from: src, to: dest });
  }
  return { name, uri: dest };
}

/** Copy an image (from a provider result / temp uri) into the gallery. */
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
