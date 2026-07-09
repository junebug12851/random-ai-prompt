/**
 * The categorized building-block groups for the palette: Blocks (the generators) and Lists. A
 * faithful port of the web `lib/promptEngine.js` getBlocks, reading the same loader interface — here
 * the Metro static-catalog loader instead of the browser runtime loader. Recomputed on each call.
 *
 * A group's `items` is a flat run of [category pill, its chips, category pill, its chips, …]; a
 * category pill is `{ category: true, label, token?, description?, forceList? }` and a chip is
 * `{ token, label, description? }`. `blockCategories.foldersOf` splits that back into folder sub-tabs.
 */
import { metroLoader as loader } from "engine/core/metroLoader.js";
import { computeButtonNames, compareNames } from "engine/nameOrder.js";
import { isGatedBlock } from "engine/gatedLists.js";

const DEFAULT_CAT_PRIORITY = 1000;
const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());
const isExpansionKey = (n) => n.startsWith("expansion/");

// The virtual "any" wildcard category (priority 0 → leads the picker).
const anyGroup = () => ({
  priority: 0,
  name: "any",
  pill: {
    category: true,
    label: "any",
    token: "{#any}",
    description: "One random generator (SFW; +NSFW when adult is on).",
  },
  entries: [
    { token: "{#any-sfw}", label: "any-sfw", description: "One random generator, SFW only." },
    {
      token: "{#any-nsfw}",
      label: "any-nsfw",
      description: "One random generator, including NSFW (adult mode only).",
    },
  ],
});

// The virtual "special" category (priority 9000 → trails the picker): engine controls (seed-salt).
const specialGroup = () => ({
  priority: 9000,
  name: "special",
  pill: {
    category: true,
    label: "special",
    description: "Engine controls that aren't drawn from any list or generator.",
  },
  entries: [
    {
      token: "{salt}",
      label: "salt",
      description:
        "Inject a random seed-salt number — nudges the result without changing the prompt.",
    },
  ],
});

/**
 * The two building-block groups (Blocks / Lists) for the palette.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] Whether nsfw-flagged blocks/lists are shown.
 * @returns {Array<{title: string, hint: string, items: Array}>}
 */
export function getBlocks(opts = {}) {
  const includeAdult = opts.includeAdult === true;

  const allDynNames = loader.blockNames();
  const forcedDirs = loader.blockForcedPrefixDirs();
  const groupSet = new Set(loader.blockGroupDirs());
  const btnNames = computeButtonNames(allDynNames, forcedDirs);

  const dpDescFor = (key) => {
    const mod = loader.loadBlock(key);
    return mod?.meta?.description || loader.readBlockMeta(key)?.description || undefined;
  };
  const isNsfwKey = (key) => loader.readBlockMeta(key)?.nsfw === true || isGatedBlock(key);

  // Folder-grouped category descriptors for a set of generator keys.
  const dynCatGroups = (keys) => {
    const visible = includeAdult ? keys : keys.filter((k) => !isNsfwKey(k));
    const byFolder = new Map();
    for (const k of visible) {
      const i = k.lastIndexOf("/");
      const folder = i < 0 ? "" : k.slice(0, i);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(k);
    }
    return [...byFolder.entries()].map(([folder, members]) => {
      const meta = loader.readBlockMeta(folder) || {};
      const pill = { category: true, label: lastSeg(folder), description: dpDescFor(folder) };
      if (groupSet.has(folder)) pill.token = `{#${lastSeg(folder)}}`;
      return {
        priority: typeof meta.priority === "number" ? meta.priority : DEFAULT_CAT_PRIORITY,
        name: lastSeg(folder),
        pill,
        entries: members
          .map((k) => ({
            token: `{#${btnNames[k]}}`,
            label: btnNames[k],
            description: dpDescFor(k),
          }))
          .sort((a, b) => compareNames(a.label, b.label)),
      };
    });
  };

  const listDisplay = computeButtonNames(loader.listNames(), loader.forcedPrefixDirs());
  const descFor = (n) =>
    (loader.readListMeta(n) || loader.readListMeta(`${n}-sfw`) || null)?.description;
  const forceListFor = (folder) => {
    const m = loader.readListMeta(folder) || loader.readListMeta(`${folder}-sfw`) || null;
    return m?.forceList === true;
  };

  const listItems = () => {
    const names = loader.listNames();
    const groupDirs = new Set(loader.groupListDirs());
    const byFolder = new Map();
    for (const n of names) {
      if (groupDirs.has(n)) continue;
      const i = n.lastIndexOf("/");
      const folder = i < 0 ? "" : n.slice(0, i);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(n);
    }
    const cats = [];
    for (const [folder, members] of byFolder) {
      cats.push({
        label: lastSeg(folder),
        token: groupDirs.has(folder) ? `{${listDisplay[folder]}}` : null,
        description: descFor(folder),
        forceList: forceListFor(folder),
        entries: members
          .map((n) => ({
            token: `{${listDisplay[n]}}`,
            label: listDisplay[n],
            description: descFor(n),
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
    // The reserved `keyword` wildcard isn't a folder/file — give it its own category.
    cats.push({
      label: "keyword",
      token: "{keyword}",
      description: "A random word drawn from ALL loaded vocabulary (every list).",
      entries: [
        { token: "{keyword-sfw}", label: "keyword-sfw", description: "All vocabulary, SFW only." },
        {
          token: "{keyword-nsfw}",
          label: "keyword-nsfw",
          description: "All vocabulary, including NSFW (adult mode only).",
        },
      ],
    });
    cats.sort((a, b) => a.label.localeCompare(b.label));
    const out = [];
    for (const c of cats) {
      const pill = { category: true, label: c.label, description: c.description };
      if (c.token) pill.token = c.token;
      if (c.forceList) pill.forceList = true;
      out.push(pill, ...c.entries);
    }
    return out;
  };

  const dynKeys = allDynNames.filter((n) => !isExpansionKey(n));
  const blockItems = [anyGroup(), ...dynCatGroups(dynKeys), specialGroup()]
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => a.priority - b.priority || compareNames(a.name, b.name))
    .flatMap((g) => [g.pill, ...g.entries]);

  // With adult off, drop any explicitly-NSFW button and prune an emptied category header.
  const dropNsfw = (items) => {
    if (includeAdult) return items;
    const kept = items.filter((i) => i.category || !/nsfw/i.test(i.token || ""));
    return kept.filter((it, k) => !it.category || (kept[k + 1] && !kept[k + 1].category));
  };

  return [
    {
      title: "Blocks",
      hint: "Every building block — scenes, subjects, fragments, and styles.",
      items: dropNsfw(blockItems),
    },
    {
      title: "Lists",
      hint: "Word lists — each insertion becomes one random entry from the list.",
      items: dropNsfw(listItems()),
    },
  ];
}

/**
 * Flatten the building-block catalog into autocomplete entries for the editor (ported from the web
 * getDplCompletions): `{ token, label, kind: "gen"|"list", description, group, category }`.
 * @returns {Array}
 */
export function getDplCompletions() {
  const out = [];
  const seen = new Set();
  for (const b of getBlocks()) {
    let category = b.title;
    for (const it of b.items) {
      if (it.category) category = it.label || b.title;
      if (!it.token || seen.has(it.token)) continue;
      seen.add(it.token);
      out.push({
        token: it.token,
        label: it.label,
        kind: it.token.startsWith("{#") ? "gen" : "list",
        description: it.description,
        group: b.title,
        category,
      });
    }
  }
  return out;
}
