/**
 * @file
 * @brief Loader implementation (Metro / React Native): reads the STATIC generated catalog
 * (metroCatalogData.js) synchronously. The THIRD isomorphic loader, beside `nodeLoader` (fs +
 * createRequire) and `browserLoader` (Vite glob), powering the Expo mobile target.
 *
 * Unlike the browser loader there is NO code-split / first-paint dance: the mobile bundle is local, so
 * the whole catalog is imported eagerly and every getter is synchronous. Unlike the node loader there is
 * no filesystem and no `createRequire`: Metro can't `require()` a runtime path, so `.js` block
 * generators are pulled in as STATIC imports by the generated module, and `.dpl` text is compiled on
 * demand here (same as the browser). It implements the identical loader interface the engine +
 * suggestion builder consume, so `createEngine(metroLoader)` runs the unchanged pipeline.
 *
 * The catalog is produced by `scripts/build-metro-catalog.mjs` (tier full|sfw). NSFW content is absent
 * from the sfw catalog, so `includeAdult` is still honoured — it simply has nothing extra to surface.
 */
import {
  resolveListLines,
  logicalListNames,
  allListNames,
  resolveName,
  compareNames,
} from "../listManifest.js";
import compileDpl from "./dpl/dpl.js";
import {
  dpJsModules,
  dpDplText,
  listLines,
  groupLines,
  dpGroupLines,
  listMetaMap,
  dpMetaMap,
  presets,
  blockKeys,
  forcedDirs,
  dpForcedDirsAll,
  groupListDirs as _groupListDirs,
  dpGroupDirs,
} from "./metroCatalogData.js";

let dplModCache = {};
const _listLinesCache = new Map(); // `${name}|${includeAdult}` -> string[]|null

// ---- Runtime user overlay (mobile Manage) ----------------------------------------------------------
// The mobile app's on-device user content (custom lists + block generators, edited in Manage) is injected
// here at RUNTIME via setMetroOverlay(); the loader consults it FIRST (user-wins) — the analog of the
// web runtime overlay (browserUserCatalog) and the node loader's [user, data] scan. It defaults to EMPTY,
// so the built-in catalog — and therefore metro-parity-check, which never populates it — is unaffected.
// NOTE: an overlay block's `.js` sidecar body can't execute on device (Metro has no runtime require/eval),
// so a user block that calls `insert js:` yields "" for that call — its DPL still runs. Same limitation
// the web notes flag for edited JS. The `.dpl` and lists apply live.
const overlay = {
  lists: Object.create(null), // logical list name -> raw text
  listMeta: Object.create(null), // list name -> meta
  blocks: Object.create(null), // block key -> raw .dpl text
  blockMeta: Object.create(null), // block key -> meta
};
let _overlayVersion = 0;
let _namesMemo = null;
let _namesMemoVersion = -1;

/**
 * Replace the runtime user overlay and invalidate the loader caches. Call with empty/omitted maps to
 * clear it (restoring the pure built-in catalog).
 * @param {{lists?:object, listMeta?:object, blocks?:object, blockMeta?:object}} [next]
 */
export function setMetroOverlay(next = {}) {
  overlay.lists = next.lists || Object.create(null);
  overlay.listMeta = next.listMeta || Object.create(null);
  overlay.blocks = next.blocks || Object.create(null);
  overlay.blockMeta = next.blockMeta || Object.create(null);
  _overlayVersion++;
  dplModCache = {};
  _listLinesCache.clear();
}

// Full list-name set (built-in + overlay), memoized until the overlay changes. Built-in-only composition
// matches the browser loader's `_allNames`; overlay list names are folded in user-wins.
function getAllNames() {
  if (_namesMemo && _namesMemoVersion === _overlayVersion) return _namesMemo;
  _namesMemo = allListNames([
    ...logicalListNames([
      ...Object.keys(listLines),
      ...Object.keys(groupLines),
      ...Object.keys(overlay.lists),
    ]),
    ..._groupListDirs,
  ]);
  _namesMemoVersion = _overlayVersion;
  return _namesMemo;
}

// Bridge for a compiled `.dpl`: resolve a JS sidecar (`script:` / `{js:}` / `insert js:`) from the
// static module map by joining the sidecar's relative path onto the `.dpl`'s key. Mirrors browserBridge;
// root-absolute (`/src/...`) paths aren't in the map and resolve to "" (those import internally).
function metroBridge(dplKey) {
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

/**
 * Metro data loader for the engine — the synchronous, static-catalog analog of nodeLoader/browserLoader.
 * Implements `readListLines`, `listNames`, `loadBlock`, `blockNames`, and the group/marker/meta/preset
 * accessors.
 * @type {object}
 */
export const metroLoader = {
  readListLines(name, includeAdult = false) {
    const cacheKey = `${name}|${includeAdult ? 1 : 0}|${_overlayVersion}`;
    if (_listLinesCache.has(cacheKey)) return _listLinesCache.get(cacheKey);
    const names = getAllNames();
    const canonical = resolveName(name, names);
    const lines = resolveListLines(
      canonical,
      {
        names,
        readListFile: (n) => overlay.lists[n] ?? listLines[n] ?? null, // user-wins
        readGroupFile: (n) => groupLines[n] ?? null,
        groupListDirs: _groupListDirs,
      },
      includeAdult,
    );
    _listLinesCache.set(cacheKey, lines);
    return lines;
  },
  listNames() {
    return getAllNames();
  },
  forcedPrefixDirs() {
    return forcedDirs;
  },
  groupListDirs() {
    return _groupListDirs;
  },
  readListMeta(name) {
    return overlay.listMeta[name] ?? listMetaMap[name] ?? null;
  },
  loadBlock(key) {
    if (dplModCache[key]) return dplModCache[key];
    // Overlay block source wins over the built-in of the same key.
    const src = overlay.blocks[key] ?? dpDplText[key];
    if (src) {
      const mod = compileDpl(src, metroBridge(key));
      dplModCache[key] = mod;
      return mod;
    }
    return dpJsModules[key] ?? null;
  },
  blockNames() {
    return [...new Set([...blockKeys, ...Object.keys(overlay.blocks)])].sort(compareNames);
  },
  readBlockMeta(name) {
    return overlay.blockMeta[name] ?? dpMetaMap[name] ?? null;
  },
  /** The raw `.dpl` source for a key (overlay-first) — used by Manage to view/override built-ins. */
  readBlockSource(key) {
    return overlay.blocks[key] ?? dpDplText[key] ?? null;
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
