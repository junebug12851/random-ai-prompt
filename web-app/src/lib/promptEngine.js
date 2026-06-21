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

// Dynamic prompts live under data/dynamic-prompts/{v3 (default),v2,v1}/<category>/. Every
// generation is browsed FIRST CLASS and identically: category-folder pills (clickable -> the
// {#folder} group, which picks ONE random generator in that folder) + each chip with its
// sidecar tooltip, split into full / partial. The only difference is the token prefix — v3 is
// bare ({#cave}, {#scene}), v1/v2 carry their path ({#v2/cave}, {#v2/scene}).
const allDynNames = browserLoader.dynamicPromptNames();
const dpDescFor = (key) => browserLoader.readDynPromptMeta(key)?.description;
const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());

// Per-generation browse data. `tag` is the token prefix ("" = v3 default, "v1"/"v2" = frozen).
const allForced = browserLoader.dynPromptForcedPrefixDirsAll
  ? browserLoader.dynPromptForcedPrefixDirsAll()
  : browserLoader.dynPromptForcedPrefixDirs();
const allGroups = browserLoader.dynPromptGroupDirsAll
  ? browserLoader.dynPromptGroupDirsAll()
  : browserLoader.dynPromptGroupDirs();
const GENS = { v3: { tag: "" }, v2: { tag: "v2" }, v1: { tag: "v1" } };
for (const [k, g] of Object.entries(GENS)) {
  g.names = allDynNames.filter((n) => n.startsWith(`${k}/`));
  g.forced = allForced.filter((d) => d.startsWith(`${k}/`));
  g.groupSet = new Set(allGroups.filter((d) => d.startsWith(`${k}/`)));
  g.btn = computeButtonNames(g.names, g.forced);
}

// Split one generation's keys into full vs partial (v1 has no partials — all full).
function splitFP(genKey) {
  const g = GENS[genKey];
  if (genKey === "v1") return { full: g.names, partial: [] };
  const full = [];
  const partial = [];
  for (const k of g.names) {
    const mod = browserLoader.loadDynamicPrompt(k);
    ((mod && mod.full === true) || k.startsWith(`${genKey}/user/`) ? full : partial).push(k);
  }
  return { full, partial };
}

// Folder-grouped chips for a set of generator keys within one generation. The chip token is
// `{#<tag>/<short>}` (bare for v3); the folder pill is a clickable `{#<tag>/<folder>}` group
// when that folder is an implied group (2+ generators).
const dynCatItems = (keys, genKey) => {
  const g = GENS[genKey];
  const pre = g.tag ? `${g.tag}/` : "";
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
      token: g.groupSet.has(folder) ? `{#${pre}${lastSeg(folder)}}` : null,
      description: dpDescFor(folder),
      entries: members
        .map((k) => ({ token: `{#${pre}${g.btn[k]}}`, label: g.btn[k], description: dpDescFor(k) }))
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

// The {#any} wildcard family for a generation — a clickable "any" category + sfw/nsfw variants.
const dynWildcardItems = (genKey) => {
  const pre = GENS[genKey].tag ? `${GENS[genKey].tag}/` : "";
  return [
    {
      category: true,
      label: "any",
      token: `{#${pre}any}`,
      description: "Pick one random generator from this generation (SFW; +NSFW when adult is on).",
    },
    { token: `{#${pre}any-sfw}`, label: "any-sfw", description: "One random generator, SFW only." },
    {
      token: `{#${pre}any-nsfw}`,
      label: "any-nsfw",
      description: "One random generator, including NSFW (adult mode only).",
    },
  ];
};

const fp = { v3: splitFP("v3"), v2: splitFP("v2"), v1: splitFP("v1") };

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
        v3: [...dynWildcardItems("v3"), ...dynCatItems(fp.v3.full, "v3")],
        v2: [...dynWildcardItems("v2"), ...dynCatItems(fp.v2.full, "v2")],
        v1: [...dynWildcardItems("v1"), ...dynCatItems(fp.v1.full, "v1")],
      },
      items: [],
    },
    {
      title: "Partial prompts",
      subLabel: "partial",
      hint: "Accents and modifiers that enrich a fuller prompt rather than stand alone.",
      dynVersioned: true,
      variants: {
        v3: dynCatItems(fp.v3.partial, "v3"),
        v2: dynCatItems(fp.v2.partial, "v2"),
        v1: dynCatItems(fp.v1.partial, "v1"),
      },
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
