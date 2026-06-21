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
import { computeButtonNames } from "../../../src/listManifest.js";
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

const dyn = promptFiles.loadDynPromptList(); // { fullRegular, partialRegular, userFiles, v1Files }
const label = (name) => _.startCase(name);
const toItems = (names, wrap) => names.map((n) => ({ token: wrap(n), label: label(n) }));

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

// Build the Expansions block as folder categories, mirroring the Lists block: an
// alphabetical run of expansions per category folder, each preceded by a category pill
// (the folder name + its description as the tooltip). Expansions are deterministic
// copy/paste snippets, not random-draw lists, so the pills are plain labels (not
// clickable groups). The button shows the shortest unambiguous token ({rays}-style),
// and its `<name>.json` description becomes the tooltip.
const expDisplay = computeButtonNames(
  browserLoader.expansionNames(),
  browserLoader.expansionForcedPrefixDirs(),
);
const expDescFor = (n) => browserLoader.readExpansionMeta(n)?.description;
const expansionItems = () => {
  const names = browserLoader.expansionNames();
  const byFolder = new Map();
  for (const n of names) {
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
      description: expDescFor(folder),
      entries: members
        .map((n) => ({ token: `<${expDisplay[n]}>`, label: expDisplay[n], description: expDescFor(n) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  cats.sort((a, b) => a.label.localeCompare(b.label));
  const out = [];
  for (const c of cats) {
    out.push({ category: true, label: c.label, description: c.description }, ...c.entries);
  }
  return out;
};

/**
 * @returns {object[]} The categorized building-block groups for the token cloud
 *   (full / partial dynamic prompts, expansions, lists, user, v1, special, plus the
 *   user's browser-local custom expansions).
 */
export function getBlocks() {
  const blocks = [
    {
      title: "Full dynamic prompts",
      hint: "Stand on their own around a theme",
      items: toItems(dyn.fullRegular, (n) => `#${n}`),
    },
    {
      title: "Partial dynamic prompts",
      hint: "Complement other parts of a prompt",
      items: toItems(dyn.partialRegular, (n) => `#${n}`),
    },
    {
      title: "Expansions",
      hint: "Insert a fixed snippet (can contain prompts/lists)",
      items: expansionItems(),
    },
    { title: "Lists", hint: "A random entry from a list", items: listItems() },
    { title: "User dynamic prompts", items: toItems(dyn.userFiles, (n) => `#${n}`) },
    { title: "V1 dynamic prompts", hint: "Legacy themed prompts", items: toItems(dyn.v1Files, (n) => `#${n}`) },
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
