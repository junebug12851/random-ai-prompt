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
} from "../listManifest.js";

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("../../", import.meta.url)); // repo root (src/core is two below)
const listsRoot = path.join(rootDir, "data", "lists");

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

// Folders (relative "/"-joined paths) that contain a given marker file.
function markedDirs(marker) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name === marker) out.push(prefix.replace(/\/$/, ""));
    }
  };
  try {
    walk(listsRoot, "");
  } catch {
    // ignore
  }
  return out;
}
const forcedPrefixDirs = () => markedDirs(".force-prefix");

// Recursively list names under data/lists as "/"-joined; `re` picks the extensions.
function physicalNames(re) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (re.test(entry.name)) out.push(`${prefix}${entry.name.replace(re, "")}`);
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
    markedDirs(".enable-group-list"),
    markedDirs(".disable-group-list"),
  );

/**
 * Node data loader for the engine: filesystem reads + `createRequire` dynamic-prompt
 * loading. Implements `readExpansion`, `readListLines`, `listNames`, `expansionNames`,
 * `loadDynamicPrompt`, `dynamicPromptNames`.
 * @type {object}
 */
export const nodeLoader = {
  readExpansion(name) {
    try {
      return fs.readFileSync(path.join(rootDir, "data", "expansions", `${name}.txt`), "utf8");
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
    try {
      return fs
        .readdirSync(path.join(rootDir, "data", "expansions"))
        .filter((f) => f.endsWith(".txt"))
        .map((f) => f.replace(/\.[^./]+$/, ""));
    } catch {
      return [];
    }
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
