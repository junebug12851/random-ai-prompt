/**
 * @file
 * @brief Engine-owned preset loading + application, shared by every Node consumer (the CLI and the
 * local backend's `/api/prompt`) so there's one copy of the preset rules. Presets are
 * `{settings, imageSettings, upscaleSettings}` JSON files that pre-configure settings (later layers —
 * flags / request overrides — always win, like the GUI). Built-ins live under `engine/data/presets/`;
 * a user overlay under `user/presets/` overrides a built-in of the same name (user-wins, matching the
 * lists/blocks overlay). Node-only (uses `fs`); the browser SPA has its own preset path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url)); // engine/ is one below the repo root
const BUILTIN_DIR = path.join(REPO_ROOT, "engine", "data", "presets");
const USER_DIR = path.join(REPO_ROOT, "user", "presets");
// User root first so a user preset overrides a built-in of the same name.
const ROOTS = [USER_DIR, BUILTIN_DIR];

/**
 * Every available preset name (union of both roots), sorted.
 * @returns {string[]} The preset names (no `.json` suffix).
 */
export function presetNames() {
  const names = new Set();
  for (const root of ROOTS) {
    let entries;
    try {
      entries = fs.readdirSync(root);
    } catch {
      entries = [];
    }
    for (const f of entries) if (f.endsWith(".json")) names.add(f.slice(0, -5));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Load one preset object by name (user root first), or null if unknown/invalid.
 * @param {string} name The preset name.
 * @returns {object|null} The preset `{settings, imageSettings, upscaleSettings}` (or null).
 */
export function loadPreset(name) {
  // The name reaches here from the /api/prompt request body, so it must be a plain preset name — never
  // usable to read arbitrary files. Reject path separators and `..` traversal before touching the fs.
  if (typeof name !== "string" || !name.trim() || /[\\/]/.test(name) || name.includes("..")) {
    return null;
  }
  for (const root of ROOTS) {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), "utf8"));
    } catch {
      // try the next root
    }
  }
  return null;
}

/**
 * Resolve a comma/space-separated preset list into preset objects, in order. Unknown names throw so
 * a typo surfaces rather than silently doing nothing.
 * @param {string} spec The preset spec (e.g. "1k, no-people").
 * @returns {object[]} The resolved preset objects.
 * @throws {Error} If a named preset doesn't exist.
 */
export function resolvePresets(spec) {
  if (!spec) return [];
  const names = String(spec)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return names.map((n) => {
    const p = loadPreset(n);
    if (!p) throw new Error(`Unknown preset "${n}"`);
    return p;
  });
}

/**
 * Apply a preset's legacy-shaped object onto flat settings. `preset.settings` merges flat; the legacy
 * `imageSettings` / `upscaleSettings` sub-objects are mapped onto the flat keys the providers read
 * (width→imageWidth, height→imageHeight, steps→imageSteps, …). Later presets/flags override.
 * @param {object} base The current flat settings.
 * @param {object} preset A preset object.
 * @returns {object} The merged settings.
 */
export function applyPreset(base, preset) {
  if (!preset || typeof preset !== "object") return base;
  const out = { ...base, ...(preset.settings || {}) };
  const img = preset.imageSettings || {};
  const map = {
    width: "imageWidth",
    height: "imageHeight",
    steps: "imageSteps",
    cfg: "cfg",
    seed: "seed",
    sampler: "sampler",
    negativePrompt: "negativePrompt",
    batchSize: "batchSize",
    restoreFaces: "restoreFaces",
  };
  for (const [from, to] of Object.entries(map)) {
    if (img[from] !== undefined) out[to] = img[from];
  }
  // Upscale settings pass through untouched (upscale consumers read them by their own keys).
  if (preset.upscaleSettings)
    out.upscaleSettings = { ...(base.upscaleSettings || {}), ...preset.upscaleSettings };
  return out;
}
