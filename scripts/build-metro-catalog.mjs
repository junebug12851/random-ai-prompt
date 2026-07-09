/**
 * @file
 * @brief Generate `engine/core/metroCatalogData.js` — a STATIC, Metro-bundlable prompt catalog that
 * mirrors the browser's eager-glob catalog (`engine/core/browserCatalogData.js`) for the React
 * Native / Expo mobile target.
 *
 * WHY THIS EXISTS: Metro (React Native's bundler) can't do Vite's `import.meta.glob` or `?raw`, and it
 * can't `require()` a runtime-computed path. So the same problem the browser solved with a glob, the
 * mobile target solves with a build-time codegen: this script walks `engine/data/` and emits ONE module
 * that STATIC-`import`s every `.js` block generator (so Metro bundles them) and INLINES every `.dpl`,
 * `.txt`, `.group`, `.json`, and preset as a literal. `engine/core/metroLoader.js` then reads that
 * module synchronously — no glob, no filesystem, no dynamic require.
 *
 * TIERS — one generator, two editions (the Play/GitHub split):
 *   --tier=full  → the complete corpus (NSFW included). The GitHub/full edition.
 *   --tier=sfw   → the ALL-AGES edition (the Play build). Every `nsfw`-token key is omitted ENTIRELY
 *                  (blocks, lists, groups, meta) so the adult content is physically absent — grep it and
 *                  you find nothing — PLUS an optional per-line all-ages scrub of list vocabulary
 *                  (cleanScrubLine) for broad-audience ("Everyone"-rated) polish. The base corpus is
 *                  already purged of slurs / minor-sexual / extreme content by contentSafety.js; the
 *                  scrub is the extra edgy-but-not-NSFW pass, a data hook wired now and tuned once we can
 *                  eyeball real output (a no-op until its lexicon is populated). No "Teen"/minor-targeted
 *                  edition exists by design: the Play build is all-ages-clean, rated Everyone, and is NOT
 *                  enrolled in the Designed-for-Families/kids program.
 *
 * NSFW gating is by NAME TOKEN, reusing the engine's own `hasNsfwToken` (gatedLists.js) — the exact
 * rule the app uses at runtime — so "SFW" here means precisely what "adult off" means everywhere else.
 * The user overlay (`user/`) is intentionally NOT scanned: the mobile target ships built-in content only.
 *
 * Run:  node scripts/build-metro-catalog.mjs [--tier=full|sfw|teen] [--out=<path>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logicalListNames, autoGroupListDirs } from "../engine/listManifest.js";
import { hasNsfwToken } from "../engine/gatedLists.js";

const rootDir = fileURLToPath(new URL("../", import.meta.url)); // repo root (scripts/ is one below)
const dataDir = path.join(rootDir, "engine", "data");
const blocksRoot = path.join(dataDir, "blocks");
const listsRoot = path.join(dataDir, "lists");
const presetsRoot = path.join(dataDir, "presets");

const argOf = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const TIER = ["full", "sfw"].includes(argOf("tier", "sfw")) ? argOf("tier", "sfw") : "sfw";
const SFW_ONLY = TIER !== "full";
const outPath = argOf("out", path.join(rootDir, "engine", "core", "metroCatalogData.js"));

// Placeholder for the all-ages scrub lexicon. Returns true to DROP a list line. The base corpus is
// already purged of slurs / minor-sexual / extreme content by contentSafety.js; this is the extra
// edgy-but-not-NSFW pass for the all-ages ("Everyone"-rated) Play build. Populate against contentSafety's
// matchers when tuned; a no-op today (SFW file-level exclusion already does the heavy lifting).
const cleanScrubLine = (_line) => false;

// ---- filesystem walk (mirrors nodeLoader / browserCatalogData key derivation) ----
function walk(root) {
  const out = [];
  const rec = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // a missing root is fine
    }
    for (const e of entries) {
      if (e.isDirectory()) rec(path.join(dir, e.name), `${prefix}${e.name}/`);
      else out.push({ abs: path.join(dir, e.name), rel: `${prefix}${e.name}` });
    }
  };
  rec(root, "");
  return out;
}
const stripExt = (rel) => rel.replace(/\.[^./]+$/, "");
const dirOf = (rel) => {
  const i = rel.lastIndexOf("/");
  return i >= 0 ? rel.slice(0, i) : "";
};
const gatedOut = (key) => SFW_ONLY && hasNsfwToken(key);

// Read a `.group` file; in SFW builds drop any line that references an nsfw-token name (dangling members
// to now-removed adult lists, and any comment mentioning them), so the emitted bundle carries no nsfw
// references at all — not merely no nsfw content.
const readGroup = (abs) => {
  const raw = fs.readFileSync(abs, "utf8");
  // Word-boundary match (not just the filename token rule) so even a PROSE comment mentioning "nsfw"
  // inside a group file is stripped from SFW builds — nothing needs the word in an all-ages bundle.
  return SFW_ONLY
    ? raw
        .split("\n")
        .filter((l) => !/\bnsfw\b/i.test(l))
        .join("\n")
    : raw;
};

// ---- collect ----
const dpJsFiles = []; // { key, importPath }
const dpDplText = {};
const dpMetaMap = {};
const dpGroupLines = {}; // raw text (split at load via S())
const listLines = {}; // raw text
const groupLines = {}; // raw text
const listMetaMap = {};
const presets = {};
const mk = {
  forceLists: [],
  enableLists: [],
  disableLists: [],
  forceBlocks: [],
  enableBlocks: [],
  disableBlocks: [],
};

for (const f of walk(blocksRoot)) {
  const base = f.rel.split("/").pop();
  if (base.startsWith("_")) {
    const d = dirOf(f.rel);
    if (base === "_force-prefix") mk.forceBlocks.push(d);
    else if (base === "_enable-group-list") mk.enableBlocks.push(d);
    else if (base === "_disable-group-list") mk.disableBlocks.push(d);
    continue;
  }
  const key = stripExt(f.rel);
  if (gatedOut(key)) continue;
  if (f.rel.endsWith(".js")) dpJsFiles.push({ key, importPath: `../data/blocks/${f.rel}` });
  else if (f.rel.endsWith(".dpl")) dpDplText[key] = fs.readFileSync(f.abs, "utf8");
  else if (f.rel.endsWith(".json")) dpMetaMap[key] = JSON.parse(fs.readFileSync(f.abs, "utf8"));
  else if (f.rel.endsWith(".group")) dpGroupLines[key] = readGroup(f.abs);
}

for (const f of walk(listsRoot)) {
  const base = f.rel.split("/").pop();
  if (base.startsWith("_")) {
    const d = dirOf(f.rel);
    if (base === "_force-prefix") mk.forceLists.push(d);
    else if (base === "_enable-group-list") mk.enableLists.push(d);
    else if (base === "_disable-group-list") mk.disableLists.push(d);
    continue;
  }
  const key = stripExt(f.rel);
  if (gatedOut(key)) continue;
  if (f.rel.endsWith(".txt")) {
    let raw = fs.readFileSync(f.abs, "utf8");
    if (SFW_ONLY)
      raw = raw
        .split("\n")
        .filter((l) => !cleanScrubLine(l))
        .join("\n");
    listLines[key] = raw;
  } else if (f.rel.endsWith(".group")) groupLines[key] = readGroup(f.abs);
  else if (f.rel.endsWith(".json")) listMetaMap[key] = JSON.parse(fs.readFileSync(f.abs, "utf8"));
}

for (const f of walk(presetsRoot)) {
  if (!f.rel.endsWith(".json")) continue;
  const key = stripExt(f.rel);
  if (gatedOut(key)) continue; // drop adult-oriented presets (e.g. the "nsfw" preset) from sfw builds
  presets[key] = JSON.parse(fs.readFileSync(f.abs, "utf8"));
}

// ---- derived sets (same helpers the browser/node loaders use, so grouping matches exactly) ----
const blockKeys = new Set(Object.keys(dpDplText));
for (const { key } of dpJsFiles) if (!dpDplText[key]) blockKeys.add(key);

const forcedDirs = mk.forceLists;
const dpForcedDirsAll = mk.forceBlocks;
const groupListDirs = autoGroupListDirs(
  logicalListNames(Object.keys(listLines)),
  mk.enableLists,
  mk.disableLists,
);
const dpGroupDirs = autoGroupListDirs([...blockKeys], mk.enableBlocks, mk.disableBlocks);

// ---- emit ----
const q = (v) => JSON.stringify(v);
const strMap = (name, obj, split) =>
  `export const ${name} = {\n` +
  Object.entries(obj)
    .map(([k, v]) => `  ${q(k)}: ${split ? `S(${q(v)})` : q(v)},`)
    .join("\n") +
  `\n};`;
const objMap = (name, obj) =>
  `export const ${name} = {\n` +
  Object.entries(obj)
    .map(([k, v]) => `  ${q(k)}: ${q(v)},`)
    .join("\n") +
  `\n};`;

const jsImports = dpJsFiles
  .map((f, i) => `import * as __b${i} from ${q(f.importPath)};`)
  .join("\n");
const jsModuleMap =
  `export const dpJsModules = {\n` +
  dpJsFiles.map((f, i) => `  ${q(f.key)}: __b${i},`).join("\n") +
  `\n};`;

const out = `/**
 * @file
 * @brief AUTO-GENERATED prompt catalog for the React Native / Expo (Metro) mobile target.
 *   DO NOT EDIT BY HAND — regenerate with \`node scripts/build-metro-catalog.mjs --tier=${TIER}\`.
 *
 * Mirrors the shape of engine/core/browserCatalogData.js (same exports) but as a fully STATIC module:
 * every \`.js\` block generator is a static import (Metro-bundlable) and every \`.dpl\`/\`.txt\`/\`.group\`/
 * \`.json\`/preset is inlined. engine/core/metroLoader.js reads this synchronously.
 *
 * Tier: ${TIER}${SFW_ONLY ? " (NSFW content physically excluded by name token)" : ""}.
 * Counts: ${blockKeys.size} block generators, ${Object.keys(listLines).length} lists, ${Object.keys(presets).length} presets.
 */
/* eslint-disable */

${jsImports || "// (no .js block generators in this tier)"}

const S = (s) => s.split("\\n");

${jsModuleMap}

${strMap("dpDplText", dpDplText, false)}

${strMap("listLines", listLines, true)}

${strMap("groupLines", groupLines, true)}

${strMap("dpGroupLines", dpGroupLines, true)}

${objMap("listMetaMap", listMetaMap)}

${objMap("dpMetaMap", dpMetaMap)}

${objMap("presets", presets)}

export const blockKeys = new Set(${q([...blockKeys])});
export const forcedDirs = ${q(forcedDirs)};
export const dpForcedDirsAll = ${q(dpForcedDirsAll)};
export const groupListDirs = ${q(groupListDirs)};
export const dpGroupDirs = ${q(dpGroupDirs)};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(
  `wrote ${path.relative(rootDir, outPath)} — tier=${TIER}: ` +
    `${blockKeys.size} blocks (${dpJsFiles.length} .js), ${Object.keys(listLines).length} lists, ` +
    `${Object.keys(groupLines).length} groups, ${Object.keys(presets).length} presets`,
);
