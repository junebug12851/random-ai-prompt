/**
 * Building-block category helpers for the palette (ported verbatim from the web
 * `lib/home/blockCategories.js`). A group's flat `items` array is a run of [folder pill, its chips,
 * …]; these split it back into folder sub-categories so the palette can offer an "All" view plus one
 * sub-tab per real folder.
 */

// Categories that get NO sub-tab of their own — the wildcard/engine pseudo-folders.
const MERGED_CATS = ["any", "special"];

/**
 * The folder sub-categories to show for a group: real folders only (the merged wildcard dropped).
 * For Lists, a single-list folder is folded into All too, unless its sidecar forces it (forceList).
 */
export function foldersOf(group) {
  let cats = splitCats(group.items).filter((c) => !MERGED_CATS.includes(c.label));
  if (group.title === "Lists") cats = cats.filter((c) => c.items.length > 1 || c.forceList);
  return cats;
}

/** Split a group's flat items run into `{ label, token?, description?, forceList?, items }` folders. */
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
