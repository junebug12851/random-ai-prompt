/**
 * @file
 * @brief Loader implementation (browser): names from glob keys (sync, free); contents loaded lazily.
 */

// Browser loader, tuned for first paint. The prompt corpus splits into two parts with very different
// costs:
//   • STRUCTURE (names) — the generator/list keys, group + marker folders. These come from the
//     `import.meta.glob` KEYS, which are just path strings inlined into the entry bundle, so they are
//     available SYNCHRONOUSLY at module load with ZERO extra download. The building-block palette is
//     built entirely from these, so the full chip cloud renders on first paint (no layout shift, no
//     waiting on the corpus).
//   • CONTENT (the actual words / generator code / `.dpl` text / presets / JSON sidecars) — the heavy
//     part (~430 KB). It's code-split into its own chunk (browserCatalogData.js) and fetched at
//     RUNTIME via a single explicit `import()` in `initBrowserCatalog`, kicked off after first paint
//     (promptEngine.ensureCatalog). Content getters (readListLines, loadBlock, descriptions,
//     presets) return empty/null until that resolves; the engine facade fires a catalog-change
//     notification on resolve so tooltips + generation light up.
//
// NSFW gating still holds during the pre-content window: the palette gates by the name token
// (isGatedBlock, name-only) — the JSON `nsfw:true` sidecar flag is a secondary signal that
// applies once content lands. Only used by the Vite SPA. See browserCatalogData.js for the content.

import {
  resolveListLines,
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  resolveName,
  compareNames,
} from "../listManifest.js";
import compileDpl from "./dpl/dpl.js";

// Lazy globs — declared ONLY so their KEYS (paths) are available synchronously. The importer
// functions are never called here (content comes from the browserCatalogData chunk), so no data is
// downloaded on their account.
// Text globs carry `query: "?raw"` so the bundler treats these files as raw strings (not JS to
// parse) even though we only ever read their KEYS here. The options MUST be an inline object literal
// — Vite only statically analyzes literal glob options. `.js` and the empty marker files are valid
// modules already.
const dpModulesGlob = import.meta.glob("../data/blocks/**/*.js");
const dpDplRawGlob = import.meta.glob("../data/blocks/**/*.dpl", {
  query: "?raw",
  import: "default",
});
const dpForcePrefixFiles = import.meta.glob("../data/blocks/**/_force-prefix");
const dpEnableGroupFiles = import.meta.glob("../data/blocks/**/_enable-group-list");
const dpDisableGroupFiles = import.meta.glob("../data/blocks/**/_disable-group-list");
const listRawGlob = import.meta.glob("../data/lists/**/*.txt", {
  query: "?raw",
  import: "default",
});
const groupRawGlob = import.meta.glob("../data/lists/**/*.group", {
  query: "?raw",
  import: "default",
});
const forcePrefixFiles = import.meta.glob("../data/lists/**/_force-prefix");
const enableGroupFiles = import.meta.glob("../data/lists/**/_enable-group-list");
const disableGroupFiles = import.meta.glob("../data/lists/**/_disable-group-list");

// ---- USER overlay (user/lists → lists, user/blocks → blocks) --------------------------
// A LOCAL/desktop feature: the hosted online build ignores it. `ONLINE` is Vite-injected
// (undefined off Vite, so the optional chain keeps this safe in plain Node); when online we drop the
// user keys from every structure set below, and initBrowserCatalog never imports the user content
// chunk. Structure (keys) comes from these lazy globs; content comes from browserUserCatalog.js.
const ONLINE = import.meta.env?.VITE_ONLINE === "true";
const userListRawGlob = import.meta.glob("../../user/lists/**/*.txt", {
  query: "?raw",
  import: "default",
});
const userGroupRawGlob = import.meta.glob("../../user/lists/**/*.group", {
  query: "?raw",
  import: "default",
});
const userDpModulesGlob = import.meta.glob("../../user/blocks/**/*.js");
const userDpDplRawGlob = import.meta.glob("../../user/blocks/**/*.dpl", {
  query: "?raw",
  import: "default",
});
const userForcePrefixFiles = import.meta.glob("../../user/lists/**/_force-prefix");
const userEnableGroupFiles = import.meta.glob("../../user/lists/**/_enable-group-list");
const userDisableGroupFiles = import.meta.glob("../../user/lists/**/_disable-group-list");
const userDpForcePrefixFiles = import.meta.glob("../../user/blocks/**/_force-prefix");
const userDpEnableGroupFiles = import.meta.glob("../../user/blocks/**/_enable-group-list");
const userDpDisableGroupFiles = import.meta.glob("../../user/blocks/**/_disable-group-list");

// ".../blocks/scene/castle.dpl" -> "scene/castle"; ".../lists/keyword.txt" -> "keyword"
function keyFor(path, dir) {
  const marker = `/${dir}/`;
  const i = path.indexOf(marker);
  const rel = i >= 0 ? path.slice(i + marker.length) : path;
  return rel.replace(/\.[^./]+$/, "");
}

// Files whose basename starts with `_` are internal/config (markers etc.), not lists.
const isInternal = (key) => key.split("/").pop().startsWith("_");

// Folders (relative to data/<seg>) that contain a `_`-prefixed marker file — from glob KEYS.
const markerDirs = (files, marker, seg = "lists") =>
  Object.keys(files).map((p) => {
    const i = p.indexOf(`/${seg}/`);
    return p.slice(i + `/${seg}/`.length).replace(new RegExp(`/${marker}$`), "");
  });

// Map a glob's KEYS to catalog keys (dropping internal `_`-prefixed files).
const keysOf = (glob, dir) =>
  Object.keys(glob)
    .map((p) => keyFor(p, dir))
    .filter((k) => !isInternal(k));

// ---- Structure (names), derived from glob KEYS synchronously at module load ----

// Built-in keys, then the user overlay concatenated on (empty when online). Duplicate names collapse
// downstream (Sets / allListNames); a user file of the same name overrides the built-in at content
// read (browserUserCatalog is overlaid last in initBrowserCatalog).
const listKeyNames = [
  ...keysOf(listRawGlob, "lists"),
  ...(ONLINE ? [] : keysOf(userListRawGlob, "lists")),
];
const groupKeyNames = [
  ...keysOf(groupRawGlob, "lists"),
  ...(ONLINE ? [] : keysOf(userGroupRawGlob, "lists")),
];
const dpDplKeys = [
  ...keysOf(dpDplRawGlob, "blocks"),
  ...(ONLINE ? [] : keysOf(userDpDplRawGlob, "blocks")),
];
const dpJsKeys = [
  ...keysOf(dpModulesGlob, "blocks"),
  ...(ONLINE ? [] : keysOf(userDpModulesGlob, "blocks")),
];

// Active generator keys: every `.dpl`, plus `.js` with no same-name `.dpl`.
const blockKeys = new Set(dpDplKeys);
for (const k of dpJsKeys) if (!dpDplKeys.includes(k)) blockKeys.add(k);

const forcedDirs = [
  ...markerDirs(forcePrefixFiles, "_force-prefix"),
  ...(ONLINE ? [] : markerDirs(userForcePrefixFiles, "_force-prefix")),
];
const dpForcedDirsAll = [
  ...markerDirs(dpForcePrefixFiles, "_force-prefix", "blocks"),
  ...(ONLINE ? [] : markerDirs(userDpForcePrefixFiles, "_force-prefix", "blocks")),
];
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
const groupListDirs = autoGroupListDirs(
  logicalListNames(listKeyNames),
  [
    ...markerDirs(enableGroupFiles, "_enable-group-list"),
    ...(ONLINE ? [] : markerDirs(userEnableGroupFiles, "_enable-group-list")),
  ],
  [
    ...markerDirs(disableGroupFiles, "_disable-group-list"),
    ...(ONLINE ? [] : markerDirs(userDisableGroupFiles, "_disable-group-list")),
  ],
);
// Implied groups for blocks: a category folder with 2+ generators.
const dpGroupDirs = autoGroupListDirs(
  [...blockKeys],
  [
    ...markerDirs(dpEnableGroupFiles, "_enable-group-list", "blocks"),
    ...(ONLINE ? [] : markerDirs(userDpEnableGroupFiles, "_enable-group-list", "blocks")),
  ],
  [
    ...markerDirs(dpDisableGroupFiles, "_disable-group-list", "blocks"),
    ...(ONLINE ? [] : markerDirs(userDpDisableGroupFiles, "_disable-group-list", "blocks")),
  ],
);
const _allNames = allListNames([
  ...logicalListNames([...listKeyNames, ...groupKeyNames]),
  ...groupListDirs,
]);

// ---- Content maps — empty until initBrowserCatalog() resolves ----
let dpJsModules = {};
let dpDplText = {};
let listLines = {};
let groupLines = {};
let presets = {};
let listMetaMap = {};
let dpMetaMap = {};
let dpGroupLines = {};

const dplModCache = {};
const _listLinesCache = new Map(); // `${name}|${includeAdult}` -> string[]|null

// Bridge for a compiled `.dpl`: resolve a JS sidecar (`script:` / `{js:}` / `insert js:`) from the
// loaded module map by joining the sidecar's relative path onto the `.dpl`'s key. Root-absolute
// (`/src/...`) paths aren't in the browser glob, so they resolve to "" (sidecars import src/ internally).
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

// ---- Async init: fetch the content chunk at runtime and populate the content maps ----

let _initPromise = null;

/**
 * Load the heavy prompt-corpus content (words, generators, `.dpl` text, sidecars, presets) from the
 * code-split chunk. Idempotent. Names/structure are already available (from glob keys); this only
 * fills the content maps. Until it resolves, content getters return empty/null.
 * @returns {Promise<void>} Resolves once the content is loaded.
 */
export function initBrowserCatalog() {
  if (_initPromise) return _initPromise;
  _initPromise = import("./browserCatalogData.js").then(async (d) => {
    // Copy the built-in maps into fresh objects so the user overlay can be layered on WITHOUT
    // mutating the imported module's exports.
    dpJsModules = { ...d.dpJsModules };
    dpDplText = { ...d.dpDplText };
    listLines = { ...d.listLines };
    groupLines = { ...d.groupLines };
    presets = d.presets;
    listMetaMap = { ...d.listMetaMap };
    dpMetaMap = { ...d.dpMetaMap };
    dpGroupLines = { ...d.dpGroupLines };
    // USER overlay (local/desktop only): fetch the separate user-content chunk and assign it LAST so
    // a user file overrides the built-in of the same name (user-wins). The online build skips this
    // entirely, so its chunk graph never references user content.
    if (!ONLINE) {
      const u = await import("./browserUserCatalog.js");
      Object.assign(dpJsModules, u.userDpJsModules);
      Object.assign(dpDplText, u.userDpDplText);
      Object.assign(listLines, u.userListLines);
      Object.assign(groupLines, u.userGroupLines);
      Object.assign(listMetaMap, u.userListMetaMap);
      Object.assign(dpMetaMap, u.userDpMetaMap);
      Object.assign(dpGroupLines, u.userDpGroupLines);
    }
    _listLinesCache.clear();
  });
  return _initPromise;
}

/**
 * Browser data loader for the engine. Names/structure are served synchronously from the bundle's
 * glob keys; contents (list lines, generators, descriptions, presets) come from the code-split chunk
 * loaded by {@link initBrowserCatalog} and read as empty/null until it resolves.
 * @type {object}
 */
export const browserLoader = {
  readListLines(name, includeAdult = false) {
    const cacheKey = `${name}|${includeAdult ? 1 : 0}`;
    if (_listLinesCache.has(cacheKey)) return _listLinesCache.get(cacheKey);
    const canonical = resolveName(name, _allNames);
    const lines = resolveListLines(
      canonical,
      {
        names: _allNames,
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
    return _allNames;
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
  loadBlock(key) {
    if (dplModCache[key]) return dplModCache[key];
    if (dpDplText[key]) {
      const mod = compileDpl(dpDplText[key], browserBridge(key));
      dplModCache[key] = mod;
      return mod;
    }
    return dpJsModules[key] ?? null;
  },
  blockNames() {
    return [...blockKeys].sort(compareNames);
  },
  readBlockMeta(name) {
    return dpMetaMap[name] ?? null;
  },
  blockForcedPrefixDirs() {
    return dpForcedDirsAll;
  },
  blockForcedPrefixDirsAll() {
    return dpForcedDirsAll;
  },
  blockGroupDirs() {
    return dpGroupDirs;
  },
  blockGroupDirsAll() {
    return dpGroupDirs;
  },
  readBlockGroup(name) {
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
 * The loaded `.js` generator module for a key (or null). Exposed so the runtime loader
 * (`gui/src/lib/runtimeLoader.js`) can execute `.js`-module generators and resolve `.dpl` JS
 * sidecars — the one thing that can't be loaded from disk text at runtime (it would need eval).
 * Returns null until {@link initBrowserCatalog} has resolved.
 * @param {string} key The generator/sidecar key (e.g. "scene/castle").
 * @returns {object|null} The ESM module namespace (with `.default`), or null if not loaded.
 */
export function dpJsModule(key) {
  return dpJsModules[key] ?? null;
}
