/**
 * @file
 * @brief Loader implementation (Node): filesystem reads plus createRequire dynamic-prompt loading.
 */

// Node loader: reads the prompt data from the filesystem and loads dynamic-prompt
// plugins with createRequire (Node 24 can require() ES modules synchronously).
// Used for Node-side verification of the engine today, and the path by which the
// CLI will share this same engine when Express is retired (migration phase 5).
//
// Two content roots per kind (the "user overlay"): the app's built-in content under `data/`, plus the
// user's own content under `user/` (lists → user/lists, dynamic prompts/"blocks" → user/blocks). The
// roots are searched in PRECEDENCE order — the USER root first — so a user file with the same name as
// a built-in OVERRIDES it (same "your override wins" rule settings follow), while a new name simply
// adds. Name enumeration unions both roots (order-independent); content reads return the first hit.
// See user/README.md + notes/systems/core-engine.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  resolveListLines,
  logicalListNames,
  allListNames,
  autoGroupListDirs,
  resolveName,
  compareNames,
} from "../listManifest.js";
import compileDpl from "./dpl/dpl.js";

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("../../", import.meta.url)); // repo root (engine/core is two below)
// Built-in corpus lives under engine/data/ (engine-owned); the user override overlay lives at the
// repo root under user/ (a universal overlay beside engine/ and targets/).
const listsRoot = path.join(rootDir, "engine", "data", "lists");
const dynPromptsRoot = path.join(rootDir, "engine", "data", "dynamic-prompts");
const userListsRoot = path.join(rootDir, "user", "lists");
const userBlocksRoot = path.join(rootDir, "user", "blocks");
// Content roots in PRECEDENCE order — user FIRST, so user content overrides built-ins on a name
// clash. `.dpl`/`.js` reads and list/group/meta reads walk these and take the first hit; name walks
// union all roots.
const listRoots = [userListsRoot, listsRoot];
const dynRoots = [userBlocksRoot, dynPromptsRoot];

// --- v3 DPL support -------------------------------------------------------
// The active dynamic-prompt catalog is v3 (`.dpl`, with optional same-name `.js` sidecars)
// plus the frozen v1 (`.js`, addressed `#name-v1`). The v2 tree stays on disk as frozen
// reference but is NOT loaded. A `.dpl` compiles to the same `{ default,
// suggestion_exclude }` module a JS generator exports, so the engine/classifier are untouched.
const dplCache = new Map();

// --- catalog / read caches -------------------------------------------------
// The on-disk data/ + user/ trees are static for the life of a Node process: the dev
// server's Manage tab hot-edits through a SEPARATE runtimeLoader, never this
// loader, and the CLI/engine/tests only read. So the directory walks (which
// recursively `readdirSync` the whole tree) and the line resolution (the
// `keyword` wildcard unions the ENTIRE vocabulary) are memoized. This turns what
// used to be ~200 `readdirSync` + a full-corpus union *per generated prompt* into
// one-time work. `nodeLoader.refresh()` drops every cache if the data ever
// changes mid-process.
const _physicalNamesCache = new Map(); // regex source -> string[]
const _markedDirsCache = new Map(); // `${bases}|${marker}` -> string[]
const _listLinesCache = new Map(); // `${name}|${includeAdult}` -> string[]|null
const _listMetaCache = new Map(); // name -> object|null
const _dynMetaCache = new Map(); // name -> object|null
const _dynGroupCache = new Map(); // name -> string[]|null
let _dynGeneratorNames = null; // string[]
let _dynNamesSorted = null; // string[] (compareNames-sorted)
let _listNames = null; // string[] (allListNames over lists + groups)

// Bridge handed to a compiled `.dpl`: resolves JS sidecars (`script:` / `{js:}` / `insert js:`)
// relative to the `.dpl` file (or root-absolute with a leading `/`), and lets JS hand control
// back to the engine (prompt/list/expand resolve as tokens the pipeline finishes downstream).
function makeDplBridge(fileDir) {
  return {
    resolveJs(p, ctx) {
      const abs = p.startsWith("/") ? path.join(rootDir, p.slice(1)) : path.resolve(fileDir, p);
      try {
        const mod = require(abs);
        const fn = mod && (mod.default || mod);
        return typeof fn === "function"
          ? (fn(ctx.settings, ctx.imageSettings, ctx.upscaleSettings, ctx.intensity, ctx.focus) ??
              "")
          : "";
      } catch {
        return "";
      }
    },
    runPrompt: (name) => `{#${String(name).replace(/^#/, "")}}`,
    runList: (name) => `{${name}}`,
    expand: (s) => s,
  };
}

// Generator keys under a dynamic-prompt root's `<category>/`, skipping `_`-prefixed internals. A
// `.dpl` is the generator; a `.js` is a generator only when no same-name `.dpl` exists (otherwise it
// is that `.dpl`'s sidecar). Unions ALL dynamic roots so user blocks add to (and can override) the
// built-in catalog.
function dynGeneratorNames() {
  if (_dynGeneratorNames) return _dynGeneratorNames;
  const dpl = new Set();
  const js = new Set();
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      } else if (!e.name.startsWith("_")) {
        if (e.name.endsWith(".dpl")) dpl.add(prefix + e.name.slice(0, -4));
        else if (e.name.endsWith(".js")) js.add(prefix + e.name.slice(0, -3));
      }
    }
  };
  for (const root of dynRoots) walk(root, "");
  const names = new Set(dpl);
  for (const n of js) if (!dpl.has(n)) names.add(n);
  _dynGeneratorNames = [...names];
  return _dynGeneratorNames;
}

// Read a list file's lines (`name.txt`) or a group file's lines (`name.group`) from the first root
// that has it (user root first), or null when missing in all roots. `name` may be a nested path like
// "danbooru/d/general".
function readFromRoots(roots, rel) {
  for (const root of roots) {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8").split("\n");
    } catch {
      /* try the next root */
    }
  }
  return null;
}
function readListFile(name) {
  return readFromRoots(listRoots, `${name}.txt`);
}
function readGroupFile(name) {
  return readFromRoots(listRoots, `${name}.group`);
}
// Optional `<name>.json` sidecar metadata (currently `{ description }`), user root first, or null.
function readListMeta(name) {
  if (_listMetaCache.has(name)) return _listMetaCache.get(name);
  let meta = null;
  for (const root of listRoots) {
    try {
      meta = JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), "utf8"));
      break;
    } catch {
      /* try the next root */
    }
  }
  _listMetaCache.set(name, meta);
  return meta;
}

// Folders (relative "/"-joined paths) that contain a given marker file, unioned across `bases`.
function markedDirs(marker, bases = listRoots) {
  const cacheKey = `${bases.join(",")}|${marker}`;
  const cached = _markedDirsCache.get(cacheKey);
  if (cached) return cached;
  const out = new Set();
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name === marker) out.add(prefix.replace(/\/$/, ""));
    }
  };
  for (const base of bases) {
    try {
      walk(base, "");
    } catch {
      // ignore a missing root
    }
  }
  const arr = [...out];
  _markedDirsCache.set(cacheKey, arr);
  return arr;
}
const forcedPrefixDirs = () => markedDirs("_force-prefix");

// Recursively list names under the list roots as "/"-joined; `re` picks the extensions. Files
// starting with `_` are internal/config (markers etc.) and never lists. Unions all list roots.
function physicalNames(re) {
  const cached = _physicalNamesCache.get(re.source);
  if (cached) return cached;
  const out = new Set();
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (!entry.name.startsWith("_") && re.test(entry.name))
        out.add(`${prefix}${entry.name.replace(re, "")}`);
    }
  };
  for (const root of listRoots) {
    try {
      walk(root, "");
    } catch {
      // ignore a missing root
    }
  }
  const arr = [...out];
  _physicalNamesCache.set(re.source, arr);
  return arr;
}
const physicalListNames = () => physicalNames(/\.(txt|group)$/);
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
let _groupListDirs = null;
const groupListDirs = () =>
  (_groupListDirs ??= autoGroupListDirs(
    logicalListNames(physicalNames(/\.txt$/)),
    markedDirs("_enable-group-list"),
    markedDirs("_disable-group-list"),
  ));
// Full list-name set (lists + implied-group dirs), memoized. Used by readListLines + listNames.
const allNames = () =>
  (_listNames ??= allListNames([...logicalListNames(physicalListNames()), ...groupListDirs()]));

/**
 * Node data loader for the engine: filesystem reads + `createRequire` dynamic-prompt
 * loading. Implements `readListLines`, `listNames`, `loadDynamicPrompt`, `dynamicPromptNames`.
 * Reads the app's built-in `data/` content AND the user overlay under `user/` (user wins on a name
 * clash).
 * @type {object}
 */
export const nodeLoader = {
  readListLines(name, includeAdult = false) {
    const cacheKey = `${name}|${includeAdult ? 1 : 0}`;
    if (_listLinesCache.has(cacheKey)) return _listLinesCache.get(cacheKey);
    const dirs = groupListDirs();
    const names = allNames();
    const canonical = resolveName(name, names);
    const lines = resolveListLines(
      canonical,
      { names, readListFile, readGroupFile, groupListDirs: dirs },
      includeAdult,
    );
    _listLinesCache.set(cacheKey, lines);
    return lines;
  },
  listNames() {
    return allNames();
  },
  forcedPrefixDirs() {
    return forcedPrefixDirs();
  },
  groupListDirs() {
    return groupListDirs();
  },
  readListMeta(name) {
    return readListMeta(name);
  },
  loadDynamicPrompt(key) {
    if (dplCache.has(key)) return dplCache.get(key);
    // User root first, so a user block overrides the built-in of the same name.
    for (const root of dynRoots) {
      const dplPath = path.join(root, `${key}.dpl`);
      if (fs.existsSync(dplPath)) {
        const mod = compileDpl(
          fs.readFileSync(dplPath, "utf8"),
          makeDplBridge(path.dirname(dplPath)),
        );
        dplCache.set(key, mod);
        return mod;
      }
      const jsPath = path.join(root, `${key}.js`);
      if (fs.existsSync(jsPath)) {
        try {
          const mod = require(jsPath);
          dplCache.set(key, mod);
          return mod;
        } catch {
          /* try the next root */
        }
      }
    }
    dplCache.set(key, null);
    return null;
  },
  // Dynamic-prompt catalog keys (`.dpl`, sidecar `.js` excluded; `.js`-only generators included),
  // skipping `_`-prefixed internals, in the guaranteed natural order.
  dynamicPromptNames() {
    _dynNamesSorted ??= [...dynGeneratorNames()].sort(compareNames);
    return _dynNamesSorted;
  },
  // Optional `<name>.json` sidecar metadata (currently `{ description }`) next to a
  // dynamic-prompt file or category folder, for the editor button/category tooltip; null if absent.
  // User root first.
  readDynPromptMeta(name) {
    if (_dynMetaCache.has(name)) return _dynMetaCache.get(name);
    let meta = null;
    for (const root of dynRoots) {
      try {
        meta = JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), "utf8"));
        break;
      } catch {
        /* try the next root */
      }
    }
    _dynMetaCache.set(name, meta);
    return meta;
  },
  // Dynamic-prompt folders marked `_force-prefix` (the prefix is shown in the #token).
  dynPromptForcedPrefixDirs() {
    return markedDirs("_force-prefix", dynRoots);
  },
  // Alias retained for the loader interface (no version generations — same set as above).
  dynPromptForcedPrefixDirsAll() {
    return markedDirs("_force-prefix", dynRoots);
  },
  // Implied-group folders for dynamic prompts: a category folder with 2+ generators (so `{#scene}`
  // picks one random scene generator), with enable/disable marker overrides.
  dynPromptGroupDirs() {
    return autoGroupListDirs(
      dynGeneratorNames(),
      markedDirs("_enable-group-list", dynRoots),
      markedDirs("_disable-group-list", dynRoots),
    );
  },
  // Alias retained for the loader interface (no version generations — same set as above).
  dynPromptGroupDirsAll() {
    return autoGroupListDirs(
      dynGeneratorNames(),
      markedDirs("_enable-group-list", dynRoots),
      markedDirs("_disable-group-list", dynRoots),
    );
  },
  // Lines of an explicit `<name>.group` dynamic-prompt group file, or null when absent. User first.
  readDynPromptGroup(name) {
    if (_dynGroupCache.has(name)) return _dynGroupCache.get(name);
    const lines = readFromRoots(dynRoots, `${name}.group`);
    _dynGroupCache.set(name, lines);
    return lines;
  },
  // Drop every memoized catalog/read cache. Call if the on-disk data/ or user/ tree is
  // mutated mid-process (the dev server's Manage tab does NOT — it uses a separate
  // runtime loader — so this exists for tests/tooling that edit data/ in place).
  refresh() {
    _physicalNamesCache.clear();
    _markedDirsCache.clear();
    _listLinesCache.clear();
    _listMetaCache.clear();
    _dynMetaCache.clear();
    _dynGroupCache.clear();
    dplCache.clear();
    _dynGeneratorNames = null;
    _dynNamesSorted = null;
    _listNames = null;
    _groupListDirs = null;
  },
};
