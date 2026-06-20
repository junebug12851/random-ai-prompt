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
import { resolveListLines, allListNames, resolveName } from "../listManifest.js";

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("../../", import.meta.url)); // repo root (src/core is two below)
const listsRoot = path.join(rootDir, "data", "lists");

// Read a single physical list file's lines (or null when missing). `name` may be a
// nested path like "danbooru/general".
function readPhysicalList(name) {
  try {
    return fs.readFileSync(path.join(listsRoot, `${name}.txt`), "utf8").split("\n");
  } catch {
    return null;
  }
}

// Recursively list every .txt under data/lists as a "/"-joined relative name.
function physicalListNames() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".txt")) out.push(`${prefix}${entry.name.replace(/\.txt$/, "")}`);
    }
  };
  try {
    walk(listsRoot, "");
  } catch {
    // ignore
  }
  return out;
}

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
  readListLines(name) {
    const canonical = resolveName(name, allListNames(physicalListNames()));
    return resolveListLines(canonical, readPhysicalList);
  },
  listNames() {
    return allListNames(physicalListNames());
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
