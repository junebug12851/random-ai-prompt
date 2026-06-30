/**
 * @file
 * @brief Loader implementation (browser): Vite import.meta.glob bundles prompts / lists / presets at build time.
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
const presetModules = import.meta.glob("../../data/presets/*.json", {
  eager: true,
  import: "default",
});

// ".../dynamic-prompts/scene/castle.dpl" -> "scene/castle"; ".../lists/keyword.txt" -> "keyword"
function keyFor(path, dir) {
  const marker = `/${dir}/`;
  const i = path.indexOf(marker);
  const rel = i >= 0 ? path.slice(i + marker.length) : path;
  return rel.replace(/\.[^./]+$/, "");
}

// Dynamic-prompt catalog = every `.dpl` (with optional same-name `.js` sidecars) plus `.js`
// generators that have no same-name `.dpl` (otherwise the `.js` is that `.dpl`'s sidecar).
// Mirrors nodeLoader.
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
        ? (fn(ctx.settings, ctx.imageSettings, ctx.upscaleSettings, ctx.intensity, ctx.focus) ?? "")
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

// Folders (relative to data/lists) that contain a `_`-prefixed marker file.
const markerDirs = (files, marker, seg = "lists") =>
  Object.keys(files).map((p) => {
    const i = p.indexOf(`/${seg}/`);
    return p.slice(i + `/${seg}/`.length).replace(new RegExp(`/${marker}$`), "");
  });
const forcedDirs = markerDirs(forcePrefixFiles, "_force-prefix");
const dpForcedDirsAll = markerDirs(dpForcePrefixFiles, "_force-prefix", "dynamic-prompts");
const dpForcedDirs = dpForcedDirsAll;
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
const groupListDirs = autoGroupListDirs(
  logicalListNames(Object.keys(listLines)),
  markerDirs(enableGroupFiles, "_enable-group-list"),
  markerDirs(disableGroupFiles, "_disable-group-list"),
);
// Implied groups for dynamic prompts: a category folder with 2+ generators.
const dpGroupDirs = autoGroupListDirs(
  [...dynamicPromptKeys],
  markerDirs(dpEnableGroupFiles, "_enable-group-list", "dynamic-prompts"),
  markerDirs(dpDisableGroupFiles, "_disable-group-list", "dynamic-prompts"),
);
// Alias retained for the loader interface (no version generations — same set as above).
const dpGroupDirsAll = dpGroupDirs;

// The bundled catalog is fixed for the life of the page (the Manage tab's live edits go
// through a SEPARATE runtime loader, never this one), so the full name set and each
// resolved `{name}` line set are memoized. Without this, every generated prompt rebuilt
// the whole name list and re-unioned the entire `keyword` wildcard vocabulary from scratch.
let _allNames = null;
const allNames = () =>
  (_allNames ??= allListNames([
    ...logicalListNames([...Object.keys(listLines), ...Object.keys(groupLines)]),
    ...groupListDirs,
  ]));
const _listLinesCache = new Map(); // `${name}|${includeAdult}` -> string[]|null
/**
 * Browser data loader for the engine: Vite `import.meta.glob` bundles. Implements
 * `readListLines`, `listNames`, `loadDynamicPrompt`, `dynamicPromptNames`, `presetNames`, `loadPreset`.
 * @type {object}
 */
export const browserLoader = {
  readListLines(name, includeAdult = false) {
    const cacheKey = `${name}|${includeAdult ? 1 : 0}`;
    if (_listLinesCache.has(cacheKey)) return _listLinesCache.get(cacheKey);
    const names = allNames();
    const canonical = resolveName(name, names);
    const lines = resolveListLines(
      canonical,
      {
        names,
        readListFile: (n) => listLines[n] ?? null,
        readGroupFile: (n) => groupLines[n] ?? null,
        groupListDirs,
      },
      includeAdult,
    );
    _listLinesCache.set(cacheKey, lines);
    return lines;
  },
  listNames() {
    return allNames();
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

/**
 * The bundled `.js` generator module for a key (or null). Exposed so the runtime loader
 * (`gui/src/lib/runtimeLoader.js`) can execute `.js`-module generators and resolve `.dpl`
 * JS sidecars from the build-time bundle — the one thing that can't be loaded from disk text
 * at runtime in the browser (it would need eval). Everything else the runtime loader serves
 * from the live disk snapshot.
 * @param {string} key The generator/sidecar key (e.g. "scene/castle").
 * @returns {object|null} The ESM module namespace (with `.default`), or null if not bundled.
 */
export function dpJsModule(key) {
  return dpJsModules[key] ?? null;
}
