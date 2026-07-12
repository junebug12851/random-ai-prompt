/**
 * @file The categorized building-block catalog — the "token cloud" behind the palette and the DPL
 * editor's autocomplete.
 *
 * This is **engine domain**: it describes the engine's own content pools (generators + lists), their
 * folder categories, the virtual `{#any}` / `{keyword}` wildcards, the NSFW gate, and the naming
 * rules. Nothing about it is a UI concern — the UI merely renders what this returns.
 *
 * It is a pure function of a **loader**, which is why it can live here at all: every target passes
 * its own (`nodeLoader` / `runtimeLoader` in the browser / `metroLoader` on the phone) and gets the
 * same catalog. It used to exist twice — `targets/web/frontend/lib/promptEngine.js` owned it and the
 * mobile target carried a 218-line hand-port (`lib/blockCatalog.js`) with **no drift check at all**,
 * which is worse than a guarded copy, not better. See `notes/plans/de-duplication.md`.
 *
 * Recomputed from the **current** loader state on every call, so a hot-apply refresh (or browsing
 * after a Manage edit) shows the live catalog.
 *
 * Shapes:
 *   group  = { title, hint, items }
 *   items  = a flat run of [category pill, its chips, category pill, its chips, …]
 *   pill   = { category: true, label, token?, description?, forceList? }
 *   chip   = { token, label, description? }
 */
import { computeButtonNames, compareNames } from "./nameOrder.js";
import { isGatedBlock } from "./gatedLists.js";

const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());

/** The default category priority when a folder's sidecar sets none (lower = higher in the picker). */
const DEFAULT_CAT_PRIORITY = 1000;

// Expansion generators (referenced as {#rays}, {#dap}, …) live under expansion/ and are NOT listed as
// pickable chips — they're excluded from the Blocks walk.
const isExpansionKey = (n) => n.startsWith("expansion/");

// The virtual "any" wildcard category (priority 0 → leads the picker): `{#any}` (and -sfw/-nsfw)
// draws one random generator from the whole catalog.
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

// The virtual "special" category (priority 9000 → trails the picker): engine controls (the seed-salt)
// that aren't drawn from any list or generator.
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
 * Build the categorized building-block groups (Blocks = the generators, Lists = the word lists).
 *
 * Within Blocks, the category/folder pills are ordered by each category's sidecar `priority`
 * (ascending; default 1000), with the virtual `any` (0) leading and `special` (9000) trailing.
 * @param {object} loader The content loader (nodeLoader / runtimeLoader / metroLoader).
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] When false (default), NSFW generators are hidden entirely and
 *   any category that empties out is dropped.
 * @returns {object[]} The Blocks + Lists groups.
 */
export function buildBlocks(loader, opts = {}) {
  const includeAdult = opts.includeAdult === true;

  // --- Catalog derivations, read live from the loader (so edits/refresh are reflected) ---
  const allDynNames = loader.blockNames();
  const forcedDirs = loader.blockForcedPrefixDirs();
  const groupSet = new Set(loader.blockGroupDirs());
  const btnNames = computeButtonNames(allDynNames, forcedDirs);

  // Tooltip text for a generator: prefer the `.dpl` front-matter `description:`, falling back to the
  // optional `.json` sidecar.
  const dpDescFor = (key) => {
    const mod = loader.loadBlock(key);
    return mod?.meta?.description || loader.readBlockMeta(key)?.description || undefined;
  };
  // A generator is adult (hard-hidden when NSFW is off) when its sidecar carries `nsfw: true` or its
  // name carries an `nsfw` token — the same predicate the engine gates on.
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
          .map((k) => ({ token: `{#${btnNames[k]}}`, label: btnNames[k], description: dpDescFor(k) }))
          .sort((a, b) => compareNames(a.label, b.label)),
      };
    });
  };

  // Shortest unambiguous display token per list.
  const listDisplay = computeButtonNames(loader.listNames(), loader.forcedPrefixDirs());
  const descFor = (n) =>
    (loader.readListMeta(n) || loader.readListMeta(`${n}-sfw`) || null)?.description;
  const forceListFor = (folder) => {
    const m = loader.readListMeta(folder) || loader.readListMeta(`${folder}-sfw`) || null;
    return m?.forceList === true;
  };

  // Build the Lists block as folder categories.
  const listItems = () => {
    const names = loader.listNames();
    const groupDirs = new Set(loader.groupListDirs());
    const byFolder = new Map();
    for (const n of names) {
      if (groupDirs.has(n)) continue; // folder-group names become pills, not entries
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
 * Flatten the building-block catalog into autocomplete entries for the DPL editor.
 * @param {object} loader The content loader.
 * @param {object} [opts] Same options as {@link buildBlocks}.
 * @returns {Array<{token: string, label: string, kind: ("gen"|"list"), description: (string|undefined), group: string, category: string}>}
 *   The completion entries.
 */
export function buildDplCompletions(loader, opts = {}) {
  const out = [];
  const seen = new Set();
  for (const b of buildBlocks(loader, opts)) {
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
