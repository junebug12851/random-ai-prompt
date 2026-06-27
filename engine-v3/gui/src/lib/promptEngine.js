/**
 * The SPA's browser-engine facade: wires the shared `core/` engine to a loader that
 * augments the bundled data with the user's browser-local custom expansions, and
 * exposes generation, live preview, the categorized building blocks, and presets.
 * @module gui/lib/promptEngine
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
import compileDpl from "../../../src/core/dpl/dpl.js";
import promptFiles from "../../../src/promptFilesAndSuggestions.js";
import { computeButtonNames, compareNames } from "../../../src/listManifest.js";
import { getCustomPresets } from "./customStore.js";

// The build-time browser bundle is the loader directly — v3-only, no expansions.
const loader = browserLoader;

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

/**
 * Render one wrapper box (a DPL snippet — the user can use bullets/probability) into a flat token
 * string. Tokens it emits ({#…}, {list}, <exp>) are resolved later by the generation pipeline.
 * @param {string} text The wrapper box's DPL text.
 * @param {object} [settings] The generation settings (passed to any JS the snippet calls).
 * @returns {string} The rendered token string (or "" when blank).
 */
export function renderWrapperPart(text, settings = {}) {
  if (!text || !text.trim()) return "";
  try {
    const mod = compileDpl(`Start\n===\n${text}`, { resolveJs: () => "" });
    return mod.default(settings, {}, {}) || "";
  } catch {
    return text; // fall back to the raw text if it isn't valid DPL
  }
}

// ---- Building blocks (the "keyword cloud"), categorized like the original ----

// Populate the classifier pools (used by the {#random-prompt} suggestion builder).
promptFiles.loadAll();
const label = (name) => _.startCase(name);
const toItems = (names, wrap) => names.map((n) => ({ token: wrap(n), label: label(n) }));

// Dynamic prompts live flat under data/dynamic-prompts/<category>/. They're browsed as
// category-folder pills (clickable -> the {#folder} group, which picks ONE random generator in
// that folder) plus each chip ({#name}, suffix-resolved) with its sidecar tooltip.
const allDynNames = browserLoader.dynamicPromptNames();
// Tooltip text for a generator. Prefer the `.dpl` front-matter `description:` (authored in the
// file itself), falling back to the optional `.json` sidecar for legacy `.js` generators.
const dpDescFor = (key) => {
  const mod = browserLoader.loadDynamicPrompt(key);
  return mod?.meta?.description || browserLoader.readDynPromptMeta(key)?.description || undefined;
};
const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());

const forcedDirs = browserLoader.dynPromptForcedPrefixDirs();
const groupSet = new Set(browserLoader.dynPromptGroupDirs());
const btnNames = computeButtonNames(allDynNames, forcedDirs);

// Folder-grouped chips for a set of generator keys. The chip token is `{#<short>}` (suffix-
// resolved); the folder pill is a clickable `{#<folder>}` group when that folder is an implied
// group (2+ generators).
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
      token: groupSet.has(folder) ? `{#${lastSeg(folder)}}` : null,
      description: dpDescFor(folder),
      // The chip label IS the token you'd type (its inner text).
      entries: members
        .map((k) => ({ token: `{#${btnNames[k]}}`, label: btnNames[k], description: dpDescFor(k) }))
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

// The wildcard family that leads the block list: `{#any}` (and -sfw/-nsfw) draws one random
// generator from the whole catalog.
const dynWildcardItems = () => [
  {
    category: true,
    label: "any",
    token: "{#any}",
    description: "One random generator (SFW; +NSFW when adult is on).",
  },
  { token: "{#any-sfw}", label: "any-sfw", description: "One random generator, SFW only." },
  {
    token: "{#any-nsfw}",
    label: "any-nsfw",
    description: "One random generator, including NSFW (adult mode only).",
  },
];

// The "special" category — engine controls (currently the seed-salt), shown as a category
// within the Blocks list.
const specialItems = () => [
  {
    category: true,
    label: "special",
    description: "Engine controls that aren't drawn from any list or generator.",
  },
  {
    token: "{salt}",
    label: "salt",
    description: "Inject a random seed-salt number — nudges the result without changing the prompt.",
  },
];

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

// Expansion generators (referenced as {#rays}, {#dap}, …) live under expansion/ and are NOT
// listed as pickable chips — they're excluded from the Blocks walk.
const isExpansionKey = (n) => n.startsWith("expansion/");

/**
 * @returns {object[]} The categorized building-block groups for the token cloud: Blocks (the
 *   generators) and Lists.
 */
export function getBlocks() {
  const blocks = [
    {
      title: "Blocks",
      hint: "Every building block — scenes, subjects, fragments, and styles.",
      items: [
        ...dynWildcardItems(),
        ...dynCatItems(allDynNames.filter((n) => !isExpansionKey(n))),
        ...specialItems(),
      ],
    },
    {
      title: "Lists",
      hint: "Word lists — each insertion becomes one random entry from the list.",
      items: listItems(),
    },
  ];

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
