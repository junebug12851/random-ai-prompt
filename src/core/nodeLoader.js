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

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("../../", import.meta.url)); // repo root (src/core is two below)
const listsRoot = path.join(rootDir, "data", "lists");
const expansionsRoot = path.join(rootDir, "data", "expansions");

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
    try {
      return require(path.join(rootDir, "src", "dynamic-prompts", `${key}.js`));
    } catch {
      return null;
    }
  },
  dynamicPromptNames() {
    const out = [];
    const base = path.join(rootDir, "src", "dynamic-prompts");
    const walk = (dir, prefix) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        else if (entry.name.endsWith(".js"))
          out.push(`${prefix}${entry.name.replace(/\.js$/, "")}`);
      }
    };
    try {
      walk(base, "");
    } catch {
      // ignore
    }
    return out;
  },
};
