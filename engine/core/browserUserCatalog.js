/**
 * @file
 * @brief The bundled USER-overlay prompt content (browser), isolated into its own code-split chunk.
 *
 * The user overlay (`user/lists` → lists, `user/blocks` → blocks) is a **local/desktop**
 * feature: the hosted online build ignores it. To keep the online bundle free of user content, this
 * module is imported ONLY when NOT online — `browserLoader.initBrowserCatalog()` does a conditional
 * `await import("./browserUserCatalog.js")` (skipped when `VITE_ONLINE`), so the online chunk graph
 * never even references it. Everything here mirrors the built-in `browserCatalogData.js` shape, but
 * scoped to the two `user/` roots, so the loader can overlay it with **user-wins** precedence.
 *
 * Patterns are relative to THIS file (src/core/): the overlay lives under repo-root user/ (../../user/).
 */

const dpModules = import.meta.glob("../../user/blocks/**/*.js", { eager: true });
const dpDplRaw = import.meta.glob("../../user/blocks/**/*.dpl", {
  query: "?raw",
  import: "default",
  eager: true,
});
const dpMetaModules = import.meta.glob("../../user/blocks/**/*.json", {
  eager: true,
  import: "default",
});
const dpGroupRaw = import.meta.glob("../../user/blocks/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const listRaw = import.meta.glob("../../user/lists/**/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const groupRaw = import.meta.glob("../../user/lists/**/*.group", {
  query: "?raw",
  import: "default",
  eager: true,
});
const metaModules = import.meta.glob("../../user/lists/**/*.json", {
  eager: true,
  import: "default",
});

// ".../user/blocks/scene/castle.dpl" -> "scene/castle"; ".../user/lists/place/x.txt" -> "place/x"
function keyFor(path, dir) {
  const marker = `/${dir}/`;
  const i = path.indexOf(marker);
  const rel = i >= 0 ? path.slice(i + marker.length) : path;
  return rel.replace(/\.[^./]+$/, "");
}
const isInternal = (key) => key.split("/").pop().startsWith("_");

export const userDpJsModules = {};
for (const [path, mod] of Object.entries(dpModules)) {
  const key = keyFor(path, "blocks");
  if (!isInternal(key)) userDpJsModules[key] = mod;
}
export const userDpDplText = {};
for (const [path, raw] of Object.entries(dpDplRaw)) {
  const key = keyFor(path, "blocks");
  if (!isInternal(key)) userDpDplText[key] = String(raw);
}
export const userListLines = {};
for (const [path, raw] of Object.entries(listRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) userListLines[key] = String(raw).split("\n");
}
export const userGroupLines = {};
for (const [path, raw] of Object.entries(groupRaw)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) userGroupLines[key] = String(raw).split("\n");
}
export const userListMetaMap = {};
for (const [path, obj] of Object.entries(metaModules)) {
  const key = keyFor(path, "lists");
  if (!isInternal(key)) userListMetaMap[key] = obj;
}
export const userDpMetaMap = {};
for (const [path, obj] of Object.entries(dpMetaModules)) {
  const key = keyFor(path, "blocks");
  if (!isInternal(key)) userDpMetaMap[key] = obj;
}
export const userDpGroupLines = {};
for (const [path, raw] of Object.entries(dpGroupRaw)) {
  const key = keyFor(path, "blocks");
  if (!isInternal(key)) userDpGroupLines[key] = String(raw).split("\n");
}
