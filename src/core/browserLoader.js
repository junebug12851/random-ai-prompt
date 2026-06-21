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

import {
  resolveListLines,
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  resolveName,
} from "../listManifest.js";

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
// Marker files are empty (extension-less); an empty file is a valid empty module, so
// the eager glob parses fine. We only use the keys (which folders contain a marker).
const forcePrefixFiles = import.meta.glob("../../data/lists/**/_force-prefix", { eager: true });
const enableGroupFiles = import.meta.glob("../../data/lists/**/_enable-group-list", { eager: true });
const disableGroupFiles = import.meta.glob("../../data/lists/**/_disable-group-list", { eager: true });
const metaModules = import.meta.glob("../../data/lists/**/*.json", { eager: true, import: "default" });
const expansionRaw = import.meta.glob("../../data/expansions/**/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const expansionMetaModules = import.meta.glob("../../data/expansions/**/*.json", {
  eager: true,
  import: "default",
});
const expForcePrefixFiles = import.meta.glob("../../data/expansions/**/_force-prefix", {
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

// Files whose basename starts with `_` are internal/config (markers etc.), not lists.
const isInternal = (key) => key.split("/").pop().startsWith("_");

const listLines = {};
for (const [path, raw] of Object.entries(listRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) listLines[key] = String(raw).split("\n");
}

const groupLines = {};
for (const [path, raw] of Object.entries(groupRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) groupLines[key] = String(raw).split("\n");
}

const expansionText = {};
for (const [path, raw] of Object.entries(expansionRaw)) {
  const key = keyFor(path, "expansions");
  if (!isInternal(key)) expansionText[key] = String(raw);
}

const expansionMetaMap = {};
for (const [path, obj] of Object.entries(expansionMetaModules)) {
  const key = keyFor(path, "expansions");
  if (!isInternal(key)) expansionMetaMap[key] = obj;
}

const presets = {};
for (const [path, obj] of Object.entries(presetModules)) {
  presets[keyFor(path, "presets")] = obj;
}

const listMetaMap = {};
for (const [path, obj] of Object.entries(metaModules)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) listMetaMap[key] = obj;
}

// Folders (relative to data/lists) that contain a `_`-prefixed marker file.
const markerDirs = (files, marker, seg = "lists") =>
  Object.keys(files).map((p) => {
    const i = p.indexOf(`/${seg}/`);
    return p.slice(i + `/${seg}/`.length).replace(new RegExp(`/${marker}$`), "");
  });
const forcedDirs = markerDirs(forcePrefixFiles, "_force-prefix");
const expForcedDirs = markerDirs(expForcePrefixFiles, "_force-prefix", "expansions");
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
const groupListDirs = autoGroupListDirs(
  logicalListNames(Object.keys(listLines)),
  markerDirs(enableGroupFiles, "_enable-group-list"),
  markerDirs(disableGroupFiles, "_disable-group-list"),
);

/**
 * Browser data loader for the engine: Vite `import.meta.glob` bundles. Implements
 * `readExpansion`, `readListLines`, `listNames`, `expansionNames`, `loadDynamicPrompt`,
 * `dynamicPromptNames`, `presetNames`, `loadPreset`.
 * @type {object}
 */
export const browserLoader = {
  readExpansion(name) {
    // Expansions nest into category folders; resolve a bare/partial `<name>` by path
    // suffix (same rule as lists) so `<rays>` still finds `lighting/rays`.
    return expansionText[resolveName(name, Object.keys(expansionText))] ?? null;
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
  readListMeta(name) {
    return listMetaMap[name] ?? null;
  },
  expansionNames() {
    return Object.keys(expansionText);
  },
  readExpansionMeta(name) {
    return expansionMetaMap[name] ?? null;
  },
  expansionForcedPrefixDirs() {
    return expForcedDirs;
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
