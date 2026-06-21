/**
 * The SPA's browser-engine facade: wires the shared `core/` engine to a loader that
 * augments the bundled data with the user's browser-local custom expansions, and
 * exposes generation, live preview, the categorized building blocks, and presets.
 * @module web-app/lib/promptEngine
 */
// The browser engine facade for the SPA.
//
// Wires the shared core engine to a loader that augments the bundled data with
// the user's browser-local custom expansions, configures the suggestion builder,
// and exposes everything the UI needs: generation, live preview, the categorized
// building blocks, and presets (built-in + custom).
import _ from "lodash";
import { createEngine } from "../../../src/core/engine.js";
import { browserLoader } from "../../../src/core/browserLoader.js";
import promptFiles from "../../../src/promptFilesAndSuggestions.js";
import { computeButtonNames, compareNames } from "../../../src/listManifest.js";
import { getCustomExpansions, getCustomPresets } from "./customStore.js";

// Composite loader: custom expansions (localStorage) shadow/extend the bundled
// ones; everything else passes through to the build-time bundle.
const loader = {
  ...browserLoader,
  readExpansion(name) {
    const custom = getCustomExpansions();
    return name in custom ? custom[name] : browserLoader.readExpansion(name);
  },
  expansionNames() {
    return [...new Set([...browserLoader.expansionNames(), ...Object.keys(getCustomExpansions())])];
  },
};

promptFiles.configure(loader);
const engine = createEngine(loader);

/**
 * Scale the emphasis / alternating knobs by `settings.chaos` (mirrors the CLI `--chaos`).
 * @param {object} settings The generation settings.
 * @returns {object} The (possibly) chaos-scaled settings.
 */
// Chaos scales the emphasis/alternating knobs (mirrors the CLI's --chaos).
function withChaos(settings) {
  const c = Number(settings.chaos);
  if (!c || c === 1) return settings;
  return {
    ...settings,
    emphasisChance: settings.emphasisChance * c,
    emphasisLevelChance: settings.emphasisLevelChance * c,
    emphasisMaxLevels: Math.round(settings.emphasisMaxLevels * c),
    deEmphasisChance: Math.min(0.5, Math.max(0.25, settings.deEmphasisChance * c)),
    keywordAlternatingMaxLevels: Math.round(settings.keywordAlternatingMaxLevels * c),
  };
}

/**
 * @param {object} settings The generation settings.
 * @returns {string} One generated prompt.
 */
export function generatePrompt(settings) {
  return engine.generate(withChaos(settings));
}
/**
 * @param {object} settings The generation settings (`promptCount`).
 * @returns {string[]} That many generated prompts.
 */
export function generatePrompts(settings) {
  return engine.generateMany(withChaos(settings));
}
/**
 * Expand a specific prompt (the live preview).
 * @param {string} prompt The prompt to expand.
 * @param {object} settings The generation settings.
 * @returns {string} The expanded prompt.
 */
export function expandPrompt(prompt, settings) {
  return engine.generate({ ...withChaos(settings), prompt });
}

// ---- Building blocks (the "keyword cloud"), categorized like the original ----

// Populate the classifier pools (used by the {#random-prompt} suggestion builder).
promptFiles.loadAll();
const label = (name) => _.startCase(name);
const toItems = (names, wrap) => names.map((n) => ({ token: wrap(n), label: label(n) }));

// Dynamic prompts live under data/dynamic-prompts/v2/<category>/ (v1/ frozen). The SPA
// shows them uniformly with Lists: category-folder pills (clickable -> the {#folder} group,
// which picks ONE random generator in that folder) + each {#name} chip with its sidecar
// tooltip. Full vs partial are separate navbar tabs; v1/v2 is a navbar superset toggle.
const allDynNames = browserLoader.dynamicPromptNames();
const v3Names = allDynNames.filter((n) => n.startsWith("v3/")); // active default catalog
const v2Names = allDynNames.filter((n) => n.startsWith("v2/")); // frozen, addressed {#v2/…}
const v1Names = allDynNames.filter((n) => n.startsWith("v1/")); // frozen, addressed {#v1/…}
const dpDescFor = (key) => browserLoader.readDynPromptMeta(key)?.description;
const dynBtn = computeButtonNames(v3Names, browserLoader.dynPromptForcedPrefixDirs());
const dynGroupSet = new Set(browserLoader.dynPromptGroupDirs());
const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());

// Split the active (v3) generators into full vs partial (user-submitted are always full).
const v3Full = [];
const v3Partial = [];
for (const k of v3Names) {
  const mod = browserLoader.loadDynamicPrompt(k);
  ((mod && mod.full === true) || k.startsWith("v3/user/") ? v3Full : v3Partial).push(k);
}

// Folder-grouped items for a set of generator keys; the folder pill is a clickable
// `{#folder}` group button when the folder is an implied group (2+ generators).
const dynCatItems = (keys) => {
  const byFolder = new Map();
  for (const k of keys) {
    const i = k.lastIndexOf("/");
    const folder = i < 0 ? "" : k.slice(0, i);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(k);
  }
  const cats = [...byFolder.entries()]
    .map(([folder, members]) => ({
      label: lastSeg(folder),
      token: dynGroupSet.has(folder) ? `{#${lastSeg(folder)}}` : null,
      description: dpDescFor(folder),
      entries: members
        .map((k) => ({ token: `{#${dynBtn[k]}}`, label: dynBtn[k], description: dpDescFor(k) }))
        .sort((a, b) => compareNames(a.label, b.label)),
    }))
    .sort((a, b) => compareNames(a.label, b.label));
  const out = [];
  for (const c of cats) {
    const pill = { category: true, label: c.label, description: c.description };
    if (c.token) pill.token = c.token;
    out.push(pill, ...c.entries);
  }
  return out;
};

// The {#any} wildcard family — like the lists' `keyword` pill: a clickable "any" category
// (inserts {#any}) with its sfw/nsfw variants as entries.
const dynWildcardItems = () => [
  {
    category: true,
    label: "any",
    token: "{#any}",
    description: "Pick one random generator from the whole catalog (SFW; +NSFW when adult is on).",
  },
  { token: "{#any-sfw}", label: "any-sfw", description: "One random generator, SFW only." },
  {
    token: "{#any-nsfw}",
    label: "any-nsfw",
    description: "One random generator, including NSFW (adult mode only).",
  },
];

// Frozen generations (v1 / v2): flat chips addressed by path prefix, e.g. {#v1/castle},
// {#v2/scene/cave}. (v3 is the default and uses bare {#name}.)
const dynFrozenItems = (keys, gen) =>
  keys
    .map((k) => {
      const base = k.slice(`${gen}/`.length);
      return { token: `{#${gen}/${base}}`, label: base, description: dpDescFor(k) };
    })
    .sort((a, b) => compareNames(a.label, b.label));

// Shortest unambiguous display token per list (filename only, unless a conflict or a
// `.force-prefix` folder like danbooru/d requires more of the path). The button shows
// and inserts this token (e.g. {color}, {d/general}) rather than the full path.
const listDisplay = computeButtonNames(browserLoader.listNames(), browserLoader.forcedPrefixDirs());
// Optional `<list>.json` sidecar description for the button tooltip. For an implicit
// base ({d/general}) or a folder, the SFW file carries it, so fall back to `<name>-sfw`.
const descFor = (n) => (loader.readListMeta(n) || loader.readListMeta(`${n}-sfw`) || null)?.description;

// Build the Lists block as folder categories: an alphabetical run of lists per folder,
// each preceded by a category pill (the folder's last-segment name + its description as
// the tooltip). When the folder is itself an implied group, the pill is clickable and
// inserts that group ({word}, {d}, ...) — merging the header and the group button.
const listItems = () => {
  const names = browserLoader.listNames();
  const groupDirs = new Set(browserLoader.groupListDirs());
  const byFolder = new Map();
  for (const n of names) {
    if (groupDirs.has(n)) continue; // folder-group names become pills, not entries
    const i = n.lastIndexOf("/");
    const folder = i < 0 ? "" : n.slice(0, i);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(n);
  }
  const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());
  const cats = [];
  for (const [folder, members] of byFolder) {
    cats.push({
      label: lastSeg(folder),
      token: groupDirs.has(folder) ? `{${listDisplay[folder]}}` : null,
      description: descFor(folder),
      entries: members
        .map((n) => ({ token: `{${listDisplay[n]}}`, label: listDisplay[n], description: descFor(n) }))
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
    out.push(pill, ...c.entries);
  }
  return out;
};

// Build the Expansions block as folder categories, mirroring the Lists block. A folder with
// 2+ expansions is an implied group, so its category pill is clickable and inserts `<folder>`
// — which splices ONE random expansion from that folder. Each entry shows the shortest
// unambiguous token ({rays}-style) with its `<name>.json` description as the tooltip.
const expDisplay = computeButtonNames(
  browserLoader.expansionNames(),
  browserLoader.expansionForcedPrefixDirs(),
);
const expDescFor = (n) => browserLoader.readExpansionMeta(n)?.description;
const expGroupSet = new Set(browserLoader.expansionGroupDirs());
const expansionItems = () => {
  const names = browserLoader.expansionNames();
  const byFolder = new Map();
  for (const n of names) {
    const i = n.lastIndexOf("/");
    const folder = i < 0 ? "" : n.slice(0, i);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(n);
  }
  const cats = [];
  for (const [folder, members] of byFolder) {
    cats.push({
      label: lastSeg(folder),
      token: expGroupSet.has(folder) ? `<${lastSeg(folder)}>` : null,
      description: expDescFor(folder),
      entries: members
        .map((n) => ({ token: `<${expDisplay[n]}>`, label: expDisplay[n], description: expDescFor(n) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  cats.sort((a, b) => a.label.localeCompare(b.label));
  const out = [];
  for (const c of cats) {
    const pill = { category: true, label: c.label, description: c.description };
    if (c.token) pill.token = c.token;
    out.push(pill, ...c.entries);
  }
  return out;
};

/**
 * @returns {object[]} The categorized building-block groups for the token cloud. The two
 *   dynamic blocks (Dynamic prompts = full, Partial prompts = partial) are `dynVersioned`
 *   and carry `variants.v2` / `variants.v1` for the navbar v1/v2 superset links; then
 *   Expansions, Lists, Special, plus the user's browser-local custom expansions.
 */
export function getBlocks() {
  const blocks = [
    {
      title: "Full prompts",
      subLabel: "full",
      hint: "Complete, self-contained generators — each builds a whole image concept on its own.",
      dynVersioned: true,
      variants: {
        v3: [...dynWildcardItems(), ...dynCatItems(v3Full)],
        v2: dynFrozenItems(v2Names, "v2"),
        v1: dynFrozenItems(v1Names, "v1"),
      },
      items: [],
    },
    {
      title: "Partial prompts",
      subLabel: "partial",
      hint: "Accents and modifiers that enrich a fuller prompt rather than stand alone.",
      dynVersioned: true,
      variants: { v3: dynCatItems(v3Partial), v2: [], v1: [] },
      items: [],
    },
    {
      title: "Expansions",
      hint: "Fixed text snippets spliced in verbatim (they can contain prompts and lists).",
      items: expansionItems(),
    },
    { title: "Lists", hint: "Word lists — each insertion becomes one random entry from the list.", items: listItems() },
    { title: "Special", items: [{ token: "{salt}", label: "Force salt here" }] },
  ];

  const custom = Object.keys(getCustomExpansions());
  if (custom.length) {
    blocks.splice(2, 0, {
      title: "Your expansions",
      hint: "Saved in this browser",
      items: toItems(custom, (n) => `<${n}>`),
    });
  }
  return blocks;
}

/**
 * @returns {string[]} The sorted list names.
 */
export function getListNames() {
  return browserLoader.listNames().slice().sort();
}

/**
 * @returns {string[]} The sorted preset names (built-in + the user's custom presets).
 */
export function getPresetNames() {
  return [...new Set([...browserLoader.presetNames(), ...Object.keys(getCustomPresets())])].sort();
}

/**
 * Load a preset's settings (a custom preset shadows a built-in of the same name).
 * @param {string} name The preset name.
 * @returns {object} The preset settings (or `{}` if unknown).
 */
export function loadPreset(name) {
  const custom = getCustomPresets();
  if (name in custom) return custom[name];
  return browserLoader.loadPreset(name) || {};
}
