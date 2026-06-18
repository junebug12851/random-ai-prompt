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

export function generatePrompt(settings) {
  return engine.generate(withChaos(settings));
}
export function generatePrompts(settings) {
  return engine.generateMany(withChaos(settings));
}
export function expandPrompt(prompt, settings) {
  return engine.generate({ ...withChaos(settings), prompt });
}

// ---- Building blocks (the "keyword cloud"), categorized like the original ----

const dyn = promptFiles.loadDynPromptList(); // { fullRegular, partialRegular, userFiles, v1Files }
const label = (name) => _.startCase(name);
const toItems = (names, wrap) => names.map((n) => ({ token: wrap(n), label: label(n) }));

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
    { title: "Lists", hint: "A random entry from a list", items: toItems(browserLoader.listNames(), (n) => `{${n}}`) },
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

export function getListNames() {
  return browserLoader.listNames().slice().sort();
}

export function getPresetNames() {
  return [...new Set([...browserLoader.presetNames(), ...Object.keys(getCustomPresets())])].sort();
}

export function loadPreset(name) {
  const custom = getCustomPresets();
  if (name in custom) return custom[name];
  return browserLoader.loadPreset(name) || {};
}
