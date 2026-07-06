/**
 * @file
 * @brief The bundled prompt corpus (browser), isolated so it can be code-split behind a single
 *   dynamic `import()`.
 *
 * All the heavy prompt data — the dynamic-prompt generator modules, the raw list/`.dpl`/`.group`
 * text, the JSON sidecars, and the presets — is gathered here via eager `import.meta.glob` and the
 * derived name/group/marker sets are computed at module load. `browserLoader.js` pulls this module
 * in with ONE explicit `await import("./browserCatalogData.js")` (see `initBrowserCatalog`), so this
 * whole corpus (~430 KB) lands in its own chunk that is fetched at RUNTIME, after first paint —
 * never on the initial (render-blocking) module graph. Keeping it in a separate module (rather than
 * globbing inside `browserLoader`) is what stops the bundler from hoisting the glob back onto the
 * entry: an explicit dynamic import of a distinct module stays dynamic.
 *
 * Patterns are relative to THIS file (src/core/): the data lives under repo-root data/ (../data/).
 */

import { logicalListNames, autoGroupListDirs } from "../listManifest.js";

const dpModules = import.meta.glob("../data/dynamic-prompts/**/*.js", { eager: true });
const dpDplRaw = import.meta.glob("../data/dynamic-prompts/**/*.dpl", {
  query: "?raw",
  import: "default",
  eager: true,
});
const dpMetaModules = import.meta.glob("../data/dynamic-prompts/**/*.json", {
  eager: true,
  import: "default",
});
const dpForcePrefixFiles = import.meta.glob("../data/dynamic-prompts/**/_force-prefix", {
  eager: true,
});
const dpGroupRaw = import.meta.glob("../data/dynamic-prompts/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const dpEnableGroupFiles = import.meta.glob("../data/dynamic-prompts/**/_enable-group-list", {
  eager: true,
});
const dpDisableGroupFiles = import.meta.glob("../data/dynamic-prompts/**/_disable-group-list", {
  eager: true,
});
const listRaw = import.meta.glob("../data/lists/**/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const groupRaw = import.meta.glob("../data/lists/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const forcePrefixFiles = import.meta.glob("../data/lists/**/_force-prefix", { eager: true });
const enableGroupFiles = import.meta.glob("../data/lists/**/_enable-group-list", {
  eager: true,
});
const disableGroupFiles = import.meta.glob("../data/lists/**/_disable-group-list", {
  eager: true,
});
const metaModules = import.meta.glob("../data/lists/**/*.json", {
  eager: true,
  import: "default",
});
const presetModules = import.meta.glob("../data/presets/*.json", {
  eager: true,
  import: "default",
});

// ".../dynamic-prompts/scene/castle.dpl" -> "scene/castle"; ".../lists/keyword.txt" -> "keyword"
function keyFor(path, dir) {
  const marker = `/${dir}/`;
  const i = path.indexOf(marker);
  const rel = i >= 0 ? path.slice(i + marker.length) : path;
  return rel.replace(/\.[^./]+$/, "");
}

// Files whose basename starts with `_` are internal/config (markers etc.), not lists.
const isInternal = (key) => key.split("/").pop().startsWith("_");

// Folders (relative to data/<seg>) that contain a `_`-prefixed marker file.
const markerDirs = (files, marker, seg = "lists") =>
  Object.keys(files).map((p) => {
    const i = p.indexOf(`/${seg}/`);
    return p.slice(i + `/${seg}/`.length).replace(new RegExp(`/${marker}$`), "");
  });

// Dynamic-prompt catalog = every `.dpl` (with optional same-name `.js` sidecars) plus `.js`
// generators that have no same-name `.dpl` (otherwise the `.js` is that `.dpl`'s sidecar).
export const dpJsModules = {};
for (const [path, mod] of Object.entries(dpModules)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpJsModules[key] = mod;
}
export const dpDplText = {};
for (const [path, raw] of Object.entries(dpDplRaw)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpDplText[key] = String(raw);
}
export const dynamicPromptKeys = new Set(Object.keys(dpDplText));
for (const k of Object.keys(dpJsModules)) if (!dpDplText[k]) dynamicPromptKeys.add(k);

export const listLines = {};
for (const [path, raw] of Object.entries(listRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) listLines[key] = String(raw).split("\n");
}
export const groupLines = {};
for (const [path, raw] of Object.entries(groupRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) groupLines[key] = String(raw).split("\n");
}
export const presets = {};
for (const [path, obj] of Object.entries(presetModules)) {
  presets[keyFor(path, "presets")] = obj;
}
export const listMetaMap = {};
for (const [path, obj] of Object.entries(metaModules)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) listMetaMap[key] = obj;
}
export const dpMetaMap = {};
for (const [path, obj] of Object.entries(dpMetaModules)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpMetaMap[key] = obj;
}
export const dpGroupLines = {};
for (const [path, raw] of Object.entries(dpGroupRaw)) {
  const key = keyFor(path, "dynamic-prompts");
  if (!isInternal(key)) dpGroupLines[key] = String(raw).split("\n");
}

export const forcedDirs = markerDirs(forcePrefixFiles, "_force-prefix");
export const dpForcedDirsAll = markerDirs(dpForcePrefixFiles, "_force-prefix", "dynamic-prompts");
// Implied groups: folders with 2+ direct lists, plus enable/disable marker overrides.
export const groupListDirs = autoGroupListDirs(
  logicalListNames(Object.keys(listLines)),
  markerDirs(enableGroupFiles, "_enable-group-list"),
  markerDirs(disableGroupFiles, "_disable-group-list"),
);
// Implied groups for dynamic prompts: a category folder with 2+ generators.
export const dpGroupDirs = autoGroupListDirs(
  [...dynamicPromptKeys],
  markerDirs(dpEnableGroupFiles, "_enable-group-list", "dynamic-prompts"),
  markerDirs(dpDisableGroupFiles, "_disable-group-list", "dynamic-prompts"),
);
