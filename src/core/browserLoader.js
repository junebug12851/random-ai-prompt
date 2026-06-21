/**
 * @file
 * @brief Loader implementation (browser): Vite import.meta.glob bundles prompts / lists / expansions / presets at build time.
 */

// Browser loader: bundles the prompt data at build time via Vite's
// `import.meta.glob`. The dynamic prompts are already ESM default-export modules,
// so they bundle directly; the lists and expansions are imported as raw text.
// This is what lets the real engine run in the browser with no Node `fs`.
//
// Only used by the Vite SPA. The patterns are relative to THIS file (src/core/):
// the dynamic-prompts are code under src/ (../dynamic-prompts); the prompt
// content (lists/expansions/presets) lives under the repo-root data/ folder
// (../../data/...).

import { resolveListLines, logicalListNames, allListNames, resolveName } from "../listManifest.js";

const dpModules = import.meta.glob("../dynamic-prompts/**/*.js", { eager: true });
const listRaw = import.meta.glob("../../data/lists/**/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const groupRaw = import.meta.glob("../../data/lists/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const forcePrefixFiles = import.meta.glob("../../data/lists/**/.force-prefix", { eager: true });
const forceGroupListFiles = import.meta.glob("../../data/lists/**/.force-group-list", { eager: true });
const expansionRaw = import.meta.glob("../../data/expansions/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const presetModules = import.meta.glob("../../data/presets/*.json", {
  eager: true,
  import: "default",
});

// ".../dynamic-prompts/v1/castle.js" -> "v1/castle"; ".../lists/keyword.txt" -> "keyword"
function keyFor(path, dir) {
  const marker = `/${dir}/`;
  const i = path.indexOf(marker);
  const rel = i >= 0 ? path.slice(i + marker.length) : path;
  return rel.replace(/\.[^./]+$/, "");
}

const dynamicPrompts = {};
for (const [path, mod] of Object.entries(dpModules)) {
  dynamicPrompts[keyFor(path, "dynamic-prompts")] = mod;
}

const listLines = {};
for (const [path, raw] of Object.entries(listRaw)) {
  listLines[keyFor(path, "lists")] = String(raw).split("\n");
}

const groupLines = {};
for (const [path, raw] of Object.entries(groupRaw)) {
  groupLines[keyFor(path, "lists")] = String(raw).split("\n");
}

const expansionText = {};
for (const [path, raw] of Object.entries(expansionRaw)) {
  expansionText[keyFor(path, "expansions")] = String(raw);
}

const presets = {};
for (const [path, obj] of Object.entries(presetModules)) {
  presets[keyFor(path, "presets")] = obj;
}

// Folders (relative to data/lists) that contain a marker file.
const markerDirs = (files, marker) =>
  Object.keys(files).map((p) => {
    const i = p.indexOf("/lists/");
    return p.slice(i + "/lists/".length).replace(new RegExp(`/${marker}$`), "");
  });
const forcedDirs = markerDirs(forcePrefixFiles, "\\.force-prefix");
const groupListDirs = markerDirs(forceGroupListFiles, "\\.force-group-list");

/**
 * Browser data loader for the engine: Vite `import.meta.glob` bundles. Implements
 * `readExpansion`, `readListLines`, `listNames`, `expansionNames`, `loadDynamicPrompt`,
 * `dynamicPromptNames`, `presetNames`, `loadPreset`.
 * @type {object}
 */
export const browserLoader = {
  readExpansion(name) {
    return expansionText[name] ?? null;
  },
  readListLines(name, includeAdult = false) {
    const names = allListNames([
      ...logicalListNames([...Object.keys(listLines), ...Object.keys(groupLines)]),
      ...groupListDirs,
    ]);
    const canonical = resolveName(name, names);
    return resolveListLines(
      canonical,
      {
        names,
        readListFile: (n) => listLines[n] ?? null,
        readGroupFile: (n) => groupLines[n] ?? null,
        groupListDirs,
      },
      includeAdult,
    );
  },
  listNames() {
    return allListNames([
      ...logicalListNames([...Object.keys(listLines), ...Object.keys(groupLines)]),
      ...groupListDirs,
    ]);
  },
  forcedPrefixDirs() {
    return forcedDirs;
  },
  groupListDirs() {
    return groupListDirs;
  },
  expansionNames() {
    return Object.keys(expansionText);
  },
  loadDynamicPrompt(key) {
    return dynamicPrompts[key] ?? null;
  },
  dynamicPromptNames() {
    return Object.keys(dynamicPrompts);
  },
  presetNames() {
    return Object.keys(presets);
  },
  loadPreset(name) {
    return presets[name] ?? null;
  },
};
