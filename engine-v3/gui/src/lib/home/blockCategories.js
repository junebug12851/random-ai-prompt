/**
 * @file Building-block category helpers for the Home palette. A group's flat `items` array is a
 * run of [folder pill, its chips, folder pill, its chips, …]; these split it back into folder
 * sub-categories so the palette can offer an "All" view plus one sub-tab per real folder.
 */

// Categories that get NO sub-tab of their own — the wildcard/engine pseudo-folders. They still
// appear in the All view as a normal category pill (header + their buttons); they just don't earn a
// folder shortcut in the tree. Every real folder (scene, subject, user, …) keeps its sub-tab.
const MERGED_CATS = ["any", "special"];

/**
 * The folder sub-categories to show for a group: real folders only (the merged wildcard dropped).
 * For Lists, a folder holding a single list is folded into All too, unless its sidecar forces it
 * (`forceList`). Their buttons still appear under All regardless.
 * @param {{title: string, items: Array}} group A building-block group.
 * @returns {Array} The folder sub-categories to surface as sub-tabs.
 */
export function foldersOf(group) {
  let cats = splitCats(group.items).filter((c) => !MERGED_CATS.includes(c.label));
  if (group.title === "Lists") cats = cats.filter((c) => c.items.length > 1 || c.forceList);
  return cats;
}

/**
 * Split a group's flat items run into `{ label, token?, description?, forceList?, items }` folders.
 * @param {Array} items The group's flat items (category pills interleaved with chips).
 * @returns {Array} The folder sub-categories.
 */
export function splitCats(items) {
  const cats = [];
  let cur = null;
  for (const it of items) {
    if (it.category) {
      cur = {
        label: it.label,
        token: it.token,
        description: it.description,
        forceList: it.forceList,
        items: [],
      };
      cats.push(cur);
    } else {
      if (!cur) {
        cur = { label: "misc", items: [] };
        cats.push(cur);
      }
      cur.items.push(it);
    }
  }
  return cats;
}
