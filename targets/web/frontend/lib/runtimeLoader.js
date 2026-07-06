/**
 * Runtime (disk-backed) loader for the SPA engine — the "Manage" tab's hot-apply path.
 *
 * The default `browserLoader` bundles all prompt data at build time via `import.meta.glob`, so it
 * can never reflect a live disk edit. This loader instead serves the catalog from a **snapshot**
 * fetched from the local-mode API (`GET /api/manage/snapshot`), so editing a list / `.dpl` /
 * sidecar / folder on disk hot-applies after a refresh — exactly like the v1–v2 system read files
 * at runtime. It implements the same loader interface the engine depends on, so nothing downstream
 * changes.
 *
 * Two states:
 *  - **No snapshot yet** (or no local backend — the online build / static host): every call
 *    delegates to `browserLoader`, so first paint and the online build behave exactly as today.
 *  - **Snapshot set**: lists, `.dpl` text, group files, sidecars, and folder/marker structure are
 *    served from the snapshot (the disk is the source of truth). The one thing that can't be loaded
 *    from text at runtime — executing a `.js` generator module, or a `.dpl`'s `.js` sidecar — is
 *    delegated to the build-time bundle (`browserLoader`), since running fetched JS would need eval.
 *    `.dpl` text is compiled at runtime (as `browserLoader` already does), so authored/edited `.dpl`
 *    and lists fully hot-apply.
 * @module gui/lib/runtimeLoader
 */
import {
  resolveListLines,
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  resolveName,
  compareNames,
} from "../../../../engine/listManifest.js";
import compileDpl from "../../../../engine/core/dpl/dpl.js";
import { browserLoader, dpJsModule } from "../../../../engine/core/browserLoader.js";

// The current disk snapshot (null = delegate everything to the bundle).
let snap = null;
// Derived, cached structures rebuilt whenever a snapshot is set.
let derived = null;
// Per-key compiled-`.dpl` cache, cleared on every snapshot swap.
let dplCache = {};

const splitLines = (text) => String(text ?? "").split("\n");
const isInternal = (key) => key.split("/").pop().startsWith("_");

/**
 * Recompute the cached name/group/marker sets from the current snapshot.
 * @returns {void}
 */
function rebuildDerived() {
  if (!snap) {
    derived = null;
    return;
  }
  const listKeys = Object.keys(snap.lists || {}).filter((k) => !isInternal(k));
  const groupKeys = Object.keys(snap.listGroups || {}).filter((k) => !isInternal(k));
  const groupListDirs = autoGroupListDirs(
    logicalListNames(listKeys),
    snap.listEnableGroupDirs || [],
    snap.listDisableGroupDirs || [],
  );
  const listNames = allListNames([
    ...logicalListNames([...listKeys, ...groupKeys]),
    ...groupListDirs,
  ]);

  // Dynamic-prompt generator keys: every `.dpl`, plus `.js`-only generators (no same-name `.dpl`).
  const dplKeys = Object.keys(snap.dpDpl || {}).filter((k) => !isInternal(k));
  const dplSet = new Set(dplKeys);
  const dpKeys = new Set(dplKeys);
  for (const k of snap.dpJsKeys || []) if (!dplSet.has(k)) dpKeys.add(k);
  const dpGroupDirs = autoGroupListDirs(
    [...dpKeys],
    snap.dpEnableGroupDirs || [],
    snap.dpDisableGroupDirs || [],
  );

  derived = {
    listKeys,
    groupKeys,
    groupListDirs,
    listNames,
    dplSet,
    dpNames: [...dpKeys].sort(compareNames),
    dpGroupDirs,
  };
}

/**
 * Bridge handed to a runtime-compiled `.dpl`: resolves JS sidecars (`script:` / `{js:}` /
 * `insert js:`) from the build-time bundle (the only place JS can execute), joining the sidecar's
 * relative path onto the `.dpl`'s key — same resolution rule as `browserLoader`'s bridge.
 * @param {string} dplKey The `.dpl` generator key.
 * @returns {object} The compile bridge.
 */
function runtimeBridge(dplKey) {
  const baseDir = dplKey.includes("/") ? dplKey.slice(0, dplKey.lastIndexOf("/")) : "";
  const joinKey = (rel) => {
    rel = rel.replace(/\.js$/, "");
    if (rel.startsWith("/")) return null; // root-absolute sidecars import src/ internally
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
      const mod = k && dpJsModule(k);
      const fn = mod && (mod.default || mod);
      return typeof fn === "function"
        ? (fn(ctx.settings, ctx.imageSettings, ctx.upscaleSettings, ctx.intensity) ?? "")
        : "";
    },
    runPrompt: (name) => `{#${String(name).replace(/^#/, "")}}`,
    runList: (name) => `{${name}}`,
    expand: (s) => s,
  };
}

/**
 * The runtime loader. Same interface as `browserLoader`/`nodeLoader`; delegates to `browserLoader`
 * until a snapshot is set, then serves from the snapshot (with bundle fallback for `.js` execution
 * and presets).
 * @type {object}
 */
export const runtimeLoader = {
  /** @returns {boolean} Whether a live disk snapshot is currently active. */
  hasSnapshot() {
    return snap != null;
  },
  /**
   * Install a fresh disk snapshot (from `GET /api/manage/snapshot`) and clear the compile cache.
   * Pass null to revert to the bundle.
   * @param {object|null} next The snapshot, or null.
   * @returns {void}
   */
  setSnapshot(next) {
    snap = next || null;
    dplCache = {};
    rebuildDerived();
  },

  readListLines(name, includeAdult = false) {
    if (!snap) return browserLoader.readListLines(name, includeAdult);
    const { listNames, groupListDirs } = derived;
    const canonical = resolveName(name, listNames);
    return resolveListLines(
      canonical,
      {
        names: listNames,
        readListFile: (n) => (n in snap.lists ? splitLines(snap.lists[n]) : null),
        readGroupFile: (n) => (n in snap.listGroups ? splitLines(snap.listGroups[n]) : null),
        groupListDirs,
      },
      includeAdult,
    );
  },
  listNames() {
    return snap ? derived.listNames : browserLoader.listNames();
  },
  forcedPrefixDirs() {
    return snap ? snap.listForcePrefixDirs || [] : browserLoader.forcedPrefixDirs();
  },
  groupListDirs() {
    return snap ? derived.groupListDirs : browserLoader.groupListDirs();
  },
  readListMeta(name) {
    if (!snap) return browserLoader.readListMeta(name);
    return snap.listMeta?.[name] ?? null;
  },
  loadBlock(key) {
    if (!snap) return browserLoader.loadBlock(key);
    if (dplCache[key]) return dplCache[key];
    const dpl = snap.dpDpl?.[key];
    if (dpl != null) {
      const mod = compileDpl(String(dpl), runtimeBridge(key));
      dplCache[key] = mod;
      return mod;
    }
    // A `.js`-module generator (no `.dpl`): execute the bundled module.
    return dpJsModule(key) ?? browserLoader.loadBlock(key);
  },
  blockNames() {
    return snap ? derived.dpNames.slice() : browserLoader.blockNames();
  },
  readBlockMeta(name) {
    if (!snap) return browserLoader.readBlockMeta(name);
    return snap.dpMeta?.[name] ?? null;
  },
  blockForcedPrefixDirs() {
    return snap ? snap.dpForcePrefixDirs || [] : browserLoader.blockForcedPrefixDirs();
  },
  blockForcedPrefixDirsAll() {
    return snap ? snap.dpForcePrefixDirs || [] : browserLoader.blockForcedPrefixDirsAll();
  },
  blockGroupDirs() {
    return snap ? derived.dpGroupDirs : browserLoader.blockGroupDirs();
  },
  blockGroupDirsAll() {
    return snap ? derived.dpGroupDirs : browserLoader.blockGroupDirsAll();
  },
  readBlockGroup(name) {
    if (!snap) return browserLoader.readBlockGroup(name);
    return name in (snap.dpGroups || {}) ? splitLines(snap.dpGroups[name]) : null;
  },
  // Presets aren't editable in Manage — always served from the bundle.
  presetNames() {
    return browserLoader.presetNames();
  },
  loadPreset(name) {
    return browserLoader.loadPreset(name);
  },
};
