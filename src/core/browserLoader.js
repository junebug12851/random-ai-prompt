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
// the dynamic-prompts and the rest of the prompt content (lists/expansions/
// presets) all live under the repo-root data/ folder (../../data/...).

import {
  resolveListLines,
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  resolveName,
  compareNames,
} from "../listManifest.js";
import compileDpl from "./dpl/dpl.js";

const dpModules = import.meta.glob("../../data/dynamic-prompts/**/*.js", { eager: true });
const dpDplRaw = import.meta.glob("../../data/dynamic-prompts/**/*.dpl", {
  query: "?raw",
  import: "default",
  eager: true,
});
const dpMetaModules = import.meta.glob("../../data/dynamic-prompts/**/*.json", {
  eager: true,
  import: "default",
});
const dpForcePrefixFiles = import.meta.glob("../../data/dynamic-prompts/**/_force-prefix", {
  eager: true,
});
const dpGroupRaw = import.meta.glob("../../data/dynamic-prompts/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const dpEnableGroupFiles = import.meta.glob("../../data/dynamic-prompts/**/_enable-group-list", {
  eager: true,
});
const dpDisableGroupFiles = import.meta.glob("../../data/dynamic-prompts/**/_disable-group-list", {
  eager: true,
});
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
const enableGroupFiles = import.meta.glob("../../data/lists/**/_enable-group-list", {
  eager: true,
});
const disableGroupFiles = import.meta.glob("../../data/lists/**/_disable-group-list", {
  eager: true,
});
const metaModules = import.meta.glob("../../data/lists/**/*.json", {
  eager: true,
  import: "default",
});
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
const expGroupRaw = import.meta.glob("../../data/expansions/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const expEnableGroupFiles = import.meta.glob("../../data/expansions/**/_enable-group-list", {
  eager: true,
});
const expDisableGroupFiles = import.meta.glob("../../data/expansions/**/_disable-group-list", {
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

// Active dynamic-prompt catalog = v3 (`.dpl`, with optional same-name `.js` sidecars) + frozen
// v1 (`.js`). The v2 tree stays on disk as reference but is NOT loaded. A `.js` is a generator
// only when there is no same-name `.dpl` (otherwise it is that `.dpl`'s sidecar). Mirrors nodeLoader.
const dpJsModules = {};
for (const [path, mod] of Object.entries(dpModules)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!key.split("/").pop().startsWith("_")) dpJsModules[key] = mod;
}
const dpDplText = {};
for (const [path, raw] of Object.entries(dpDplRaw)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!key.split("/").pop().startsWith("_")) dpDplText[key] = String(raw);
}

// Active generator keys: every `.dpl`, plus `.js` with no same-name `.dpl`.
const dynamicPromptKeys = new Set(Object.keys(dpDplText));
for (const k of Object.keys(dpJsModules)) if (!dpDplText[k]) dynamicPromptKeys.add(k);

// Bridge for a compiled `.dpl`: resolve a JS sidecar (`script:` / `{js:}` / `insert js:`) from the
// bundled module map by joining the sidecar's relative path onto the `.dpl`'s key. Root-absolute
// (`/src/...`) paths aren't in the browser glob, so they resolve to "" (sidecars import src/ internally).
const dplModCache = {};
function browserBridge(dplKey) {
  const baseDir = dplKey.includes("/") ? dplKey.slice(0, dplKey.lastIndexOf("/")) : "";
  const joinKey = (rel) => {
    rel = rel.replace(/\.js$/, "");
    if (rel.startsWith("/")) return null;
    const parts = baseDir ? baseDir.split("/") : [];
    for (const seg of rel.split("/")) {
      if (seg === "." || seg === "") continue;
      else if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  };
  return {
    resolveJs(p, ctx) {
      const k = joinKey(p);
      const mod = k && dpJsModules[k];
      const fn = mod && (mod.default || mod);
      return typeof fn === "function"
        ? (fn(ctx.settings, ctx.imageSettings, ctx.upscaleSettings) ?? "")
        : "";
    },
    runPrompt: (name) => `{#${String(name).replace(/^#/, "")}}`,
    runList: (name) => `{${name}}`,
    expand: (s) => s,
  };
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

const dpMetaMap = {};
for (const [path, obj] of Object.entries(dpMetaModules)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpMetaMap[key] = obj;
}

const dpGroupLines = {};
for (const [path, raw] of Object.entries(dpGroupRaw)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpGroupLines[key] = String(raw).split("\n");
}

const expGroupLines = {};
for (const [path, raw] of Object.entries(expGroupRaw)) {
  const key = keyFor(path, "expansions");
  if (!isInternal(key)) expGroupLines[key] = String(raw).split("\n");
}

// Folders (relative to data/lists) that contain a `_`-prefixed marker file.
const markerDirs = (files, marker, seg = "lists") =>
  Object.keys(files).map((p) => {
    const i = p.indexOf(`/${seg}/`);
    return p.slice(i + `/${seg}/`.length).replace(new RegExp(`/${marker}$`), "");
  });
const forcedDirs = markerDirs(forcePrefixFiles, "_force-prefix");
const expForcedDirs = markerDirs(expForcePrefixFiles, "_force-prefix", "expansions");
const dpForcedDirsAll = markerDirs(dpForcePrefixFiles, "_force-prefix", "dynamic-prompts");
const dpForcedDirs = dpForcedDirsAll.filter((d) => d.startsWith("v3/"));
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
const groupListDirs = autoGroupListDirs(
  logicalListNames(Object.keys(listLines)),
  markerDirs(enableGroupFiles, "_enable-group-list"),
  markerDirs(disableGroupFiles, "_disable-group-list"),
);
// Implied groups for dynamic prompts (v2 folder with 2+ generators) and expansions.
const dpGroupDirs = autoGroupListDirs(
  [...dynamicPromptKeys].filter((n) => n.startsWith("v3/")),
  markerDirs(dpEnableGroupFiles, "_enable-group-list", "dynamic-prompts").filter((d) =>
    d.startsWith("v3/"),
  ),
  markerDirs(dpDisableGroupFiles, "_disable-group-list", "dynamic-prompts").filter((d) =>
    d.startsWith("v3/"),
  ),
);
// All generations (v1/v2/v3) — the engine/UI filter by prefix so each generation is first-class.
const dpGroupDirsAll = autoGroupListDirs(
  [...dynamicPromptKeys],
  markerDirs(dpEnableGroupFiles, "_enable-group-list", "dynamic-prompts"),
  markerDirs(dpDisableGroupFiles, "_disable-group-list", "dynamic-prompts"),
);
const expGroupDirs = autoGroupListDirs(
  Object.keys(expansionText),
  markerDirs(expEnableGroupFiles, "_enable-group-list", "expansions"),
  markerDirs(expDisableGroupFiles, "_disable-group-list", "expansions"),
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
  expansionGroupDirs() {
    return expGroupDirs;
  },
  readExpansionGroup(name) {
    return expGroupLines[name] ?? null;
  },
  loadDynamicPrompt(key) {
    if (dplModCache[key]) return dplModCache[key];
    if (dpDplText[key]) {
      const mod = compileDpl(dpDplText[key], browserBridge(key));
      dplModCache[key] = mod;
      return mod;
    }
    return dpJsModules[key] ?? null;
  },
  dynamicPromptNames() {
    return [...dynamicPromptKeys].sort(compareNames);
  },
  readDynPromptMeta(name) {
    return dpMetaMap[name] ?? null;
  },
  dynPromptForcedPrefixDirs() {
    return dpForcedDirs;
  },
  dynPromptForcedPrefixDirsAll() {
    return dpForcedDirsAll;
  },
  dynPromptGroupDirs() {
    return dpGroupDirs;
  },
  dynPromptGroupDirsAll() {
    return dpGroupDirsAll;
  },
  readDynPromptGroup(name) {
    return dpGroupLines[name] ?? null;
  },
  presetNames() {
    return Object.keys(presets);
  },
  loadPreset(name) {
    return presets[name] ?? null;
  },
};
