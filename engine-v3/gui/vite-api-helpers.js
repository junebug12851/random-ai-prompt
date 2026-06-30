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
const STORE_FILE = path.join(guiRoot, ".gui-storage.json");
// The central output folder — every provider's generated images land here on disk
// (engine-v3/output, the project's runtime output dir), served back via /api/output/<file>.
export const OUTPUT_DIR = path.join(guiRoot, "..", "output");

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

/** @returns {object} The on-disk store (or `{}`). */
export function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @param {object} store The store to persist.
 * @returns {void}
 */
export function writeStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch {
    // best-effort
  }
}
