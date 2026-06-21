/**
 * @file
 * @brief Loader implementation (Node): filesystem reads plus createRequire dynamic-prompt loading.
 */

// Node loader: reads the prompt data from the filesystem and loads dynamic-prompt
// plugins with createRequire (Node 24 can require() ES modules synchronously).
// Used for Node-side verification of the engine today, and the path by which the
// CLI will share this same engine when Express is retired (migration phase 5).
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
const rootDir = fileURLToPath(new URL("../../", import.meta.url)); // repo root (src/core is two below)
const listsRoot = path.join(rootDir, "data", "lists");
const expansionsRoot = path.join(rootDir, "data", "expansions");
const dynPromptsRoot = path.join(rootDir, "data", "dynamic-prompts");

// --- v3 DPL support -------------------------------------------------------
// The active dynamic-prompt catalog is v3 (`.dpl`, with optional same-name `.js` sidecars)
// plus the frozen v1 (`.js`, addressed `#name-v1`). The v2 tree stays on disk as frozen
// reference but is NOT loaded. A `.dpl` compiles to the same `{ default, full,
// suggestion_exclude }` module a JS generator exports, so the engine/classifier are untouched.
const dplCache = new Map();

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
          ? (fn(ctx.settings, ctx.imageSettings, ctx.upscaleSettings) ?? "")
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

// Generator keys across all generations: v3/** (active, `.dpl`), v2/** and v1/** (frozen, `.js`),
// skipping `_`-prefixed internals. A `.dpl` is the generator; a `.js` is a generator only when no
// same-name `.dpl` exists (otherwise it is that `.dpl`'s sidecar). The stage decides which
// generation a `{#…}` reaches (bare → v3; `v1/`/`v2/` prefix or `-v1`/`-v2` suffix → frozen).
function dynGeneratorNames() {
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
  walk(dynPromptsRoot, "");
  const names = new Set(dpl);
  for (const n of js) if (!dpl.has(n)) names.add(n);
  return [...names];
}

// Recursively list names under a root as "/"-joined paths; `re` picks the extension.
// Files starting with `_` are internal/config (markers etc.) and never content. Used
// for the expansion tree (which nests into category folders just like data/lists).
function namesUnder(base, re) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (!entry.name.startsWith("_") && re.test(entry.name))
        out.push(`${prefix}${entry.name.replace(re, "")}`);
    }
  };
  try {
    walk(base, "");
  } catch {
    // ignore
  }
  return out;
}

// Read a list file's lines (`name.txt`) or a group file's lines (`name.group`),
// or null when missing. `name` may be a nested path like "danbooru/d/general".
function readListFile(name) {
  try {
    return fs.readFileSync(path.join(listsRoot, `${name}.txt`), "utf8").split("\n");
  } catch {
    return null;
  }
}
function readGroupFile(name) {
  try {
    return fs.readFileSync(path.join(listsRoot, `${name}.group`), "utf8").split("\n");
  } catch {
    return null;
  }
}
// Optional `<name>.json` sidecar metadata (currently `{ description }`), or null.
function readListMeta(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(listsRoot, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

// Folders (relative "/"-joined paths) under `base` that contain a given marker file.
function markedDirs(marker, base = listsRoot) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name === marker) out.push(prefix.replace(/\/$/, ""));
    }
  };
  try {
    walk(base, "");
  } catch {
    // ignore
  }
  return out;
}
const forcedPrefixDirs = () => markedDirs("_force-prefix");
// Expansion folders marked `_force-prefix` (the prefix is shown/used, e.g. detail/legacy).
const expansionForcedPrefixDirs = () => markedDirs("_force-prefix", expansionsRoot);

// Recursively list names under data/lists as "/"-joined; `re` picks the extensions.
// Files starting with `_` are internal/config (markers etc.) and never lists.
function physicalNames(re) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (!entry.name.startsWith("_") && re.test(entry.name))
        out.push(`${prefix}${entry.name.replace(re, "")}`);
    }
  };
  try {
    walk(listsRoot, "");
  } catch {
    // ignore
  }
  return out;
}
const physicalListNames = () => physicalNames(/\.(txt|group)$/);
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
const groupListDirs = () =>
  autoGroupListDirs(
    logicalListNames(physicalNames(/\.txt$/)),
    markedDirs("_enable-group-list"),
    markedDirs("_disable-group-list"),
  );

/**
 * Node data loader for the engine: filesystem reads + `createRequire` dynamic-prompt
 * loading. Implements `readExpansion`, `readListLines`, `listNames`, `expansionNames`,
 * `loadDynamicPrompt`, `dynamicPromptNames`.
 * @type {object}
 */
export const nodeLoader = {
  readExpansion(name) {
    // Expansions nest into category folders; resolve a bare/partial `<name>` by path
    // suffix (same rule as lists) so `<rays>` still finds `lighting/rays`.
    const canonical = resolveName(name, namesUnder(expansionsRoot, /\.txt$/));
    try {
      return fs.readFileSync(path.join(expansionsRoot, `${canonical}.txt`), "utf8");
    } catch {
      return null;
    }
  },
  readListLines(name, includeAdult = false) {
    const dirs = groupListDirs();
    const names = allListNames([...logicalListNames(physicalListNames()), ...dirs]);
    const canonical = resolveName(name, names);
    return resolveListLines(
      canonical,
      { names, readListFile, readGroupFile, groupListDirs: dirs },
      includeAdult,
    );
  },
  listNames() {
    return allListNames([...logicalListNames(physicalListNames()), ...groupListDirs()]);
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
  expansionNames() {
    return namesUnder(expansionsRoot, /\.txt$/).sort(compareNames);
  },
  // Optional `<name>.json` sidecar metadata (currently `{ description }`) next to an
  // expansion file or category folder, for the editor button/category tooltip; null if absent.
  readExpansionMeta(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(expansionsRoot, `${name}.json`), "utf8"));
    } catch {
      return null;
    }
  },
  expansionForcedPrefixDirs() {
    return expansionForcedPrefixDirs();
  },
  loadDynamicPrompt(key) {
    if (dplCache.has(key)) return dplCache.get(key);
    const dplPath = path.join(dynPromptsRoot, `${key}.dpl`);
    if (fs.existsSync(dplPath)) {
      const mod = compileDpl(fs.readFileSync(dplPath, "utf8"), makeDplBridge(path.dirname(dplPath)));
      dplCache.set(key, mod);
      return mod;
    }
    try {
      const mod = require(path.join(dynPromptsRoot, `${key}.js`));
      dplCache.set(key, mod);
      return mod;
    } catch {
      return null;
    }
  },
  // Active dynamic-prompt catalog keys: v3/** (`.dpl`, sidecar `.js` excluded) + v1/** (`.js`),
  // skipping the frozen v2/** tree and `_`-prefixed internals, in the guaranteed natural order.
  dynamicPromptNames() {
    return dynGeneratorNames().sort(compareNames);
  },
  // Optional `<name>.json` sidecar metadata (currently `{ description }`) next to a
  // dynamic-prompt file or category folder, for the editor button/category tooltip; null if absent.
  readDynPromptMeta(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dynPromptsRoot, `${name}.json`), "utf8"));
    } catch {
      return null;
    }
  },
  // Dynamic-prompt folders marked `_force-prefix` (the prefix is shown in the #token) — active (v3) only.
  dynPromptForcedPrefixDirs() {
    return markedDirs("_force-prefix", dynPromptsRoot).filter((d) => d.startsWith("v3/"));
  },
  // Same, across ALL generations (v1/v2/v3) — for the UI that browses each generation first-class.
  dynPromptForcedPrefixDirsAll() {
    return markedDirs("_force-prefix", dynPromptsRoot);
  },
  // Implied-group folders for dynamic prompts: an active (v3) category folder with 2+ generators
  // (so `{#scene}` picks one random scene generator), with enable/disable marker overrides.
  dynPromptGroupDirs() {
    return autoGroupListDirs(
      dynGeneratorNames().filter((n) => n.startsWith("v3/")),
      markedDirs("_enable-group-list", dynPromptsRoot).filter((d) => d.startsWith("v3/")),
      markedDirs("_disable-group-list", dynPromptsRoot).filter((d) => d.startsWith("v3/")),
    );
  },
  // Implied-group folders across ALL generations (v1/v2/v3) — the engine/UI filter by prefix so
  // each generation's groups ({#scene}, {#v2/scene}) resolve and display first-class.
  dynPromptGroupDirsAll() {
    return autoGroupListDirs(
      dynGeneratorNames(),
      markedDirs("_enable-group-list", dynPromptsRoot),
      markedDirs("_disable-group-list", dynPromptsRoot),
    );
  },
  // Lines of an explicit `<name>.group` dynamic-prompt group file, or null when absent.
  readDynPromptGroup(name) {
    try {
      return fs.readFileSync(path.join(dynPromptsRoot, `${name}.group`), "utf8").split("\n");
    } catch {
      return null;
    }
  },
  // Implied-group folders for expansions: a category folder with 2+ expansions (so `<scene>`
  // splices one random scene expansion), with enable/disable marker overrides.
  expansionGroupDirs() {
    return autoGroupListDirs(
      namesUnder(expansionsRoot, /\.txt$/),
      markedDirs("_enable-group-list", expansionsRoot),
      markedDirs("_disable-group-list", expansionsRoot),
    );
  },
  // Lines of an explicit `<name>.group` expansion group file, or null when absent.
  readExpansionGroup(name) {
    try {
      return fs.readFileSync(path.join(expansionsRoot, `${name}.group`), "utf8").split("\n");
    } catch {
      return null;
    }
  },
};
