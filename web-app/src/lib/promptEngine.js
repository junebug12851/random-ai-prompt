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
// base ({d/general}) the SFW file carries it, so fall back to `<name>-sfw`.
const listMetaFor = (n) => loader.readListMeta(n) || loader.readListMeta(`${n}-sfw`) || null;
const listItems = () =>
  browserLoader.listNames().map((n) => {
    const item = { token: `{${listDisplay[n]}}`, label: listDisplay[n] };
    const desc = listMetaFor(n)?.description;
    if (desc) item.description = desc;
    return item;
  });

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
      items: toItems(browserLoader.expansionNames(), (n) => `<${n}>`),
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
