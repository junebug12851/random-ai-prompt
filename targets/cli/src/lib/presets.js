/**
 * @file
 * @brief Preset loading for the CLI. Presets are `{settings, imageSettings, upscaleSettings}` JSON
 * files that pre-configure settings (command-line flags always override last, like the GUI's presets
 * and the original CLI). Built-ins live under `engine/data/presets/`; a user overlay under
 * `user/presets/` overrides a built-in of the same name (user-wins, matching the lists/blocks overlay).
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.js";

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
  return [...names].sort();
}

/**
 * Load one preset object by name (user root first), or null if unknown/invalid.
 * @param {string} name The preset name.
 * @returns {object|null} The preset `{settings, imageSettings, upscaleSettings}` (or null).
 */
export function loadPreset(name) {
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
 * the user learns of a typo rather than silently getting nothing.
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
    if (!p) throw new Error(`Unknown preset "${n}". See: rap list presets`);
    return p;
  });
}
