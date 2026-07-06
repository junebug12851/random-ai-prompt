/**
 * @file Helpers for the dev-server API plugin (vite-plugin-api.js): the output-folder constants,
 * ImageMagick detection, the path-traversal-safe output-file resolver, the JSON request/response
 * helpers, and the on-disk BYOK key store. Pulled out so the plugin file is just the route wiring,
 * and so the pure pieces (notably `resolveOutputFile`) are unit-testable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execP = promisify(exec);

const guiRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.join(guiRoot, "..");
// Legacy single-file store (pre-folder layout). Kept only so we can migrate it once.
const STORE_FILE = path.join(guiRoot, ".gui-storage.json");
// The one settings folder, now under the unified repo-root `user/` home (settings + lists + blocks
// all under user/). Every namespace is a `.json` file here, with `/`-delimited namespaces (e.g.
// `providers/openai`) becoming subfolders (`user/settings/providers/openai.json`). This is the
// local-mode equivalent of the browser's `localStorage` — all user storage in one place.
export const USER_DIR = path.join(repoRoot, "user", "settings");
// The previous settings folder (`gui/user-settings/`), before it moved under `user/`. Migrated once.
const LEGACY_USER_DIR = path.join(guiRoot, "user-settings");
// The central output folder — every provider's generated images land here on disk
// (output, the project's runtime output dir), served back via /api/output/<file>.
export const OUTPUT_DIR = path.join(repoRoot, "output");

export const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  jxl: "image/jxl",
  ico: "image/x-icon",
};

// Still (non-animated) raster formats we're willing to offer as conversion targets. The actual
// menu is this set intersected with what the installed ImageMagick reports as writable, so we
// never list a format the local binary can't produce. Animated/video/vector targets are excluded.
const STILL_FORMATS = new Set([
  "JPEG", "JPG", "PNG", "WEBP", "GIF", "BMP", "TIFF", "TIF", "TGA", "AVIF", "HEIC", "HEIF",
  "JXL", "PPM", "PGM", "PNM", "PAM", "ICO", "DIB", "QOI", "JP2", "SGI", "XPM", "PCX", "PALM",
]);

// Detected once per dev-server run: whether ImageMagick is on PATH and which still formats it can
// write. Cached because shelling out to `magick -list format` isn't free.
let magickCache = null;

/**
 * Detect ImageMagick and the still-image formats it can write.
 * @returns {Promise<{available: boolean, bin: string|null, formats: string[]}>}
 */
export async function detectMagick() {
  if (magickCache) return magickCache;
  let bin = null;
  for (const cand of ["magick", "convert"]) {
    try {
      await execP(`${cand} -version`, { timeout: 5000 });
      bin = cand;
      break;
    } catch {
      // not this one — try the next
    }
  }
  if (!bin) {
    magickCache = { available: false, bin: null, formats: [] };
    return magickCache;
  }
  const formats = [];
  try {
    const { stdout } = await execP(`${bin} -list format`, { timeout: 8000 });
    const seen = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const name = parts[0].replace(/\*+$/, "").toUpperCase();
      // The mode column looks like `rw-` / `r--` / `-w+`; writable = the middle char is `w`.
      const mode = parts.find((t) => /^[rR-][wW-][-+]$/.test(t));
      if (!mode || mode[1].toLowerCase() !== "w") continue;
      if (!STILL_FORMATS.has(name)) continue;
      const ext = name === "JPEG" ? "jpg" : name.toLowerCase();
      if (seen.has(ext)) continue;
      seen.add(ext);
      formats.push(ext);
    }
    formats.sort();
  } catch {
    // couldn't list formats — report magick present but with no menu
  }
  magickCache = { available: true, bin, formats };
  return magickCache;
}

/**
 * Resolve a served image path (`/api/output/<name>` or a bare name) to a safe absolute file in
 * the output folder. Rejects path traversal.
 * @param {string} p The served path or filename.
 * @returns {string|null} The absolute file path, or null if invalid.
 */
export function resolveOutputFile(p) {
  if (typeof p !== "string") return null;
  const name = decodeURIComponent(p.replace(/^\/api\/output\//, ""));
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return path.join(OUTPUT_DIR, name);
}

/**
 * Read a request's JSON body.
 * @param {import("node:http").IncomingMessage} req The request.
 * @returns {Promise<object>} The parsed body (or `{}`).
 */
export function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Send a JSON response.
 * @param {import("node:http").ServerResponse} res The response.
 * @param {number} status HTTP status.
 * @param {object} obj Body.
 * @returns {void}
 */
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

/**
 * Resolve a storage namespace to a safe absolute `.json` file under {@link USER_DIR}. Namespaces are
 * `/`-delimited (e.g. `providers/openai`); each segment must be a clean filename. Rejects empty
 * segments, `.`/`..`, and backslashes (path traversal). Also guards the final path stays within
 * USER_DIR.
 * @param {string} ns The namespace.
 * @param {string} [dir] The base folder (defaults to {@link USER_DIR}).
 * @returns {string|null} The absolute file path, or null if the namespace is invalid.
 */
export function nsToFile(ns, dir = USER_DIR) {
  if (typeof ns !== "string" || !ns) return null;
  const segments = ns.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("\\") || seg.includes("\0")) return null;
  }
  const abs = path.join(dir, ...segments) + ".json";
  const rel = path.relative(dir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

/**
 * Read one namespace's value from its file.
 * @param {string} ns The namespace.
 * @param {string} [dir] The base folder (defaults to {@link USER_DIR}).
 * @returns {*} The stored value, or null if absent / unreadable.
 */
export function readNs(ns, dir = USER_DIR) {
  const fp = nsToFile(ns, dir);
  if (!fp) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write one namespace's value to its file (creating subfolders as needed).
 * @param {string} ns The namespace.
 * @param {*} value The JSON value to store.
 * @param {string} [dir] The base folder (defaults to {@link USER_DIR}).
 * @returns {boolean} True on success.
 */
export function writeNs(ns, value, dir = USER_DIR) {
  const fp = nsToFile(ns, dir);
  if (!fp) return false;
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    // Atomic write: serialize to a temp file in the same folder, then rename over the target. A
    // reader (e.g. the file-watch settings reload) therefore never sees a half-written file — it
    // observes either the old contents or the complete new ones. Guards the never-corrupt rule.
    const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, fp);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete one namespace's file (best-effort; prunes a now-empty subfolder).
 * @param {string} ns The namespace.
 * @param {string} [dir] The base folder (defaults to {@link USER_DIR}).
 * @returns {void}
 */
export function removeNs(ns, dir = USER_DIR) {
  const fp = nsToFile(ns, dir);
  if (!fp) return;
  try {
    fs.rmSync(fp, { force: true });
    const parent = path.dirname(fp);
    if (parent !== dir && fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
      fs.rmdirSync(parent);
    }
  } catch {
    // best-effort
  }
}

/**
 * List every stored namespace by walking the folder (subfolders ⇒ `/`-delimited namespaces).
 * @param {string} [dir] The base folder (defaults to {@link USER_DIR}).
 * @returns {string[]} The namespaces (no `.json` suffix, forward-slash separated).
 */
export function listNs(dir = USER_DIR) {
  const out = [];
  const walk = (d, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(d, e.name), prefix ? `${prefix}/${e.name}` : e.name);
      } else if (e.isFile() && e.name.endsWith(".json")) {
        const base = e.name.slice(0, -5);
        out.push(prefix ? `${prefix}/${base}` : base);
      }
    }
  };
  walk(dir, "");
  return out;
}

/**
 * One-time migrations of older settings-storage layouts into the current `user/settings/` home.
 * Runs on server boot; idempotent and best-effort (never throws into the server):
 *   1. The previous per-namespace folder `gui/user-settings/` → `user/settings/`. Each namespace is
 *      copied only when the new home doesn't already have it (never clobbering current settings), then
 *      the old folder is renamed aside so it isn't re-migrated.
 *   2. The ancient flat `.gui-storage.json` → the folder layout (old `presets:<id>` colon keys map to
 *      a `presets/<id>` subpath), only when the new home is still empty.
 * @returns {void}
 */
export function migrateLegacyStore() {
  // 1) Fold the previous per-namespace folder (gui/user-settings/) into the new user/settings/ home.
  try {
    if (fs.existsSync(LEGACY_USER_DIR)) {
      for (const ns of listNs(LEGACY_USER_DIR)) {
        if (readNs(ns, USER_DIR) == null) {
          const val = readNs(ns, LEGACY_USER_DIR);
          if (val != null) writeNs(ns, val, USER_DIR);
        }
      }
      try {
        fs.renameSync(LEGACY_USER_DIR, `${LEGACY_USER_DIR}.migrated`);
      } catch {
        // best-effort: leaving it in place just means we skip-copy again next boot (idempotent)
      }
    }
  } catch {
    // best-effort
  }
  // 2) Fold the ancient flat single-file store into the folder home (only if it's still empty).
  try {
    if (fs.existsSync(STORE_FILE) && listNs(USER_DIR).length === 0) {
      const store = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      if (store && typeof store === "object") {
        for (const [key, value] of Object.entries(store)) writeNs(key.replace(/:/g, "/"), value);
      }
      fs.renameSync(STORE_FILE, `${STORE_FILE}.migrated`);
    }
  } catch {
    // best-effort: a failed migration just means the old file is read fresh next start
  }
}
