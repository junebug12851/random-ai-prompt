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
import { isGatedDynPrompt } from "../../../src/gatedLists.js";
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

// The default category priority when a folder's sidecar sets none (lower = higher in the picker).
const DEFAULT_CAT_PRIORITY = 1000;
// A generator is adult (hard-hidden when NSFW is off) when its sidecar carries `nsfw: true` or
// its name carries an `nsfw` token — the same predicate the engine gates on.
const isNsfwKey = (key) =>
  browserLoader.readDynPromptMeta(key)?.nsfw === true || isGatedDynPrompt(key);

// Folder-grouped category descriptors for a set of generator keys: `{ priority, name, pill,
// entries }`. The chip token is `{#<short>}` (suffix-resolved); the folder pill is a clickable
// `{#<folder>}` group when that folder is an implied group (2+ generators). `priority` comes from
// the folder's `.json` sidecar (default 1000). When `includeAdult` is off, nsfw generators are
// dropped entirely (so a wholly-adult category vanishes).
const dynCatGroups = (keys, includeAdult) => {
  const visible = includeAdult ? keys : keys.filter((k) => !isNsfwKey(k));
  const byFolder = new Map();
  for (const k of visible) {
    const i = k.lastIndexOf("/");
    const folder = i < 0 ? "" : k.slice(0, i);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(k);
  }
  return [...byFolder.entries()].map(([folder, members]) => {
    const meta = browserLoader.readDynPromptMeta(folder) || {};
    const pill = { category: true, label: lastSeg(folder), description: dpDescFor(folder) };
    if (groupSet.has(folder)) pill.token = `{#${lastSeg(folder)}}`;
    return {
      priority: typeof meta.priority === "number" ? meta.priority : DEFAULT_CAT_PRIORITY,
      name: lastSeg(folder),
      pill,
      // The chip label IS the token you'd type (its inner text).
      entries: members
        .map((k) => ({ token: `{#${btnNames[k]}}`, label: btnNames[k], description: dpDescFor(k) }))
        .sort((a, b) => compareNames(a.label, b.label)),
    };
  });
};

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

// The virtual "special" category (priority 9000 → trails the picker): engine controls (the
// seed-salt) that aren't drawn from any list or generator.
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
 * The categorized building-block groups for the token cloud: Blocks (the generators) and Lists.
 * Within Blocks, the category/folder pills are ordered by each category's sidecar `priority`
 * (ascending — lower lifts it higher; default 1000), with the virtual `any` (0) leading and
 * `special` (9000) trailing.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] When false (default), nsfw generators are hidden entirely
 *   and any category that empties out is dropped.
 * @returns {object[]} The Blocks + Lists groups.
 */
export function getBlocks(opts = {}) {
  const includeAdult = opts.includeAdult === true;
  const dynKeys = allDynNames.filter((n) => !isExpansionKey(n));
  const blockItems = [anyGroup(), ...dynCatGroups(dynKeys, includeAdult), specialGroup()]
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => a.priority - b.priority || compareNames(a.name, b.name))
    .flatMap((g) => [g.pill, ...g.entries]);

  return [
    {
      title: "Blocks",
      hint: "Every building block — scenes, subjects, fragments, and styles.",
      items: blockItems,
    },
    {
      title: "Lists",
      hint: "Word lists — each insertion becomes one random entry from the list.",
      items: listItems(),
    },
  ];
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
