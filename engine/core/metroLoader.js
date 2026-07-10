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

// Full list-name set (logical list + group names, plus implied-group dirs) — same composition the
// browser loader uses for `_allNames`.
const _allNames = allListNames([
  ...logicalListNames([...Object.keys(listLines), ...Object.keys(groupLines)]),
  ..._groupListDirs,
]);

const dplModCache = {};
const _listLinesCache = new Map(); // `${name}|${includeAdult}` -> string[]|null

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
    const cacheKey = `${name}|${includeAdult ? 1 : 0}`;
    if (_listLinesCache.has(cacheKey)) return _listLinesCache.get(cacheKey);
    const canonical = resolveName(name, _allNames);
    const lines = resolveListLines(
      canonical,
      {
        names: _allNames,
        readListFile: (n) => listLines[n] ?? null,
        readGroupFile: (n) => groupLines[n] ?? null,
        groupListDirs: _groupListDirs,
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
    return _groupListDirs;
  },
  readListMeta(name) {
    return listMetaMap[name] ?? null;
  },
  loadBlock(key) {
    if (dplModCache[key]) return dplModCache[key];
    if (dpDplText[key]) {
      const mod = compileDpl(dpDplText[key], metroBridge(key));
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
