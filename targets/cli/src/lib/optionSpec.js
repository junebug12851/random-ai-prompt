/**
 * @file
 * @brief The single source of truth for every generation flag. Each entry maps a CLI flag to a
 * settings key with a coercion type, so ONE list drives (a) commander option registration, (b)
 * parsing flags → settings overrides, and (c) shell completion. Every field in `engine/settings.js`
 * has a flag here (engine parity), plus the GUI's provider / image / rewrite knobs (GUI parity).
 * Booleans take an explicit value (`--emphasis false`) so any setting can be forced either way and
 * omitting the flag leaves the persisted/default value untouched.
 */

/**
 * @typedef {object} FlagSpec
 * @property {string} flag The commander flag string (e.g. "--max-count <n>").
 * @property {string} opt The camelCase option attribute commander derives (e.g. "maxCount").
 * @property {string} key The `settings` key this flag overrides.
 * @property {"int"|"float"|"number"|"bool"|"string"|"csv"} type The value coercion.
 * @property {string} desc Help text.
 * @property {string} group A grouping label (for --help sections).
 * @property {string[]|(() => Promise<string[]>)} [choices] Static/dynamic completion values.
 */

/** @type {FlagSpec[]} Prompt-engine flags — one per engine/settings.js field. */
export const ENGINE_FLAGS = [
  {
    flag: "--count <n>",
    opt: "count",
    key: "keywordCount",
    type: "int",
    group: "Prompt engine",
    desc: "Number of keywords to generate",
  },
  {
    flag: "--max-count <n>",
    opt: "maxCount",
    key: "keywordMaxCount",
    type: "int",
    group: "Prompt engine",
    desc: "Max keywords (= count for no randomness)",
  },
  {
    flag: "--prompts <n>",
    opt: "prompts",
    key: "promptCount",
    type: "int",
    group: "Prompt engine",
    desc: "How many prompts to generate",
  },
  {
    flag: "--mode <mode>",
    opt: "mode",
    key: "mode",
    type: "string",
    group: "Prompt engine",
    desc: "Emphasis dialect",
    choices: ["StableDiffusion", "NovelAI", "Midjourney", "Plain"],
  },
  {
    flag: "--emphasis <bool>",
    opt: "emphasis",
    key: "keywordEmphasis",
    type: "bool",
    group: "Prompt engine",
    desc: "Randomly (de)emphasize keywords",
  },
  {
    flag: "--emphasis-chance <f>",
    opt: "emphasisChance",
    key: "emphasisChance",
    type: "float",
    group: "Prompt engine",
    desc: "Chance a keyword is emphasized (0–1)",
  },
  {
    flag: "--emphasis-level-chance <f>",
    opt: "emphasisLevelChance",
    key: "emphasisLevelChance",
    type: "float",
    group: "Prompt engine",
    desc: "Chance of an extra emphasis level (0–1)",
  },
  {
    flag: "--emphasis-max-levels <n>",
    opt: "emphasisMaxLevels",
    key: "emphasisMaxLevels",
    type: "int",
    group: "Prompt engine",
    desc: "Max emphasis levels",
  },
  {
    flag: "--de-emphasis-chance <f>",
    opt: "deEmphasisChance",
    key: "deEmphasisChance",
    type: "float",
    group: "Prompt engine",
    desc: "Chance emphasis becomes de-emphasis (0–1)",
  },
  {
    flag: "--editing <bool>",
    opt: "editing",
    key: "keywordEditing",
    type: "bool",
    group: "Prompt engine",
    desc: "Add/swap/remove keywords mid-generation",
  },
  {
    flag: "--editing-min <n>",
    opt: "editingMin",
    key: "keywordEditingMin",
    type: "number",
    group: "Prompt engine",
    desc: "Min steps/percent for editing",
  },
  {
    flag: "--editing-max <n>",
    opt: "editingMax",
    key: "keywordEditingMax",
    type: "number",
    group: "Prompt engine",
    desc: "Max steps/percent for editing",
  },
  {
    flag: "--alternating <bool>",
    opt: "alternating",
    key: "keywordAlternating",
    type: "bool",
    group: "Prompt engine",
    desc: "Alternate keywords (hybrid effects)",
  },
  {
    flag: "--alternating-max-levels <n>",
    opt: "alternatingMaxLevels",
    key: "keywordAlternatingMaxLevels",
    type: "int",
    group: "Prompt engine",
    desc: "Max alternating levels",
  },
  {
    flag: "--use-artists <bool>",
    opt: "useArtists",
    key: "includeArtist",
    type: "bool",
    group: "Prompt engine",
    desc: "Also add artist keywords",
  },
  {
    flag: "--min-artists <n>",
    opt: "minArtists",
    key: "minArtist",
    type: "int",
    group: "Prompt engine",
    desc: "Min artists to add",
  },
  {
    flag: "--max-artists <n>",
    opt: "maxArtists",
    key: "maxArtist",
    type: "int",
    group: "Prompt engine",
    desc: "Max artists to add",
  },
  {
    flag: "--artists <name>",
    opt: "artists",
    key: "artistFilename",
    type: "string",
    group: "Prompt engine",
    desc: "Artist list name (false = fully random)",
  },
  {
    flag: "--keywords <name>",
    opt: "keywords",
    key: "keywordsFilename",
    type: "string",
    group: "Prompt engine",
    desc: "Keyword list name (false = fully random)",
  },
  {
    flag: "--natural-artist-style <bool>",
    opt: "naturalArtistStyle",
    key: "naturalArtistStyle",
    type: "bool",
    group: "Prompt engine",
    desc: 'Frame as "by <artist>" / "in the style of <style>"',
  },
  {
    flag: "--auto-artists <bool>",
    opt: "autoArtists",
    key: "autoAddArtists",
    type: "bool",
    group: "Prompt engine",
    desc: "Auto-append an artists block",
  },
  {
    flag: "--auto-fx <bool>",
    opt: "autoFx",
    key: "autoAddFx",
    type: "bool",
    group: "Prompt engine",
    desc: "Auto-append image effects",
  },
  {
    flag: "--noand <bool>",
    opt: "noand",
    key: "noAnd",
    type: "bool",
    group: "Prompt engine",
    desc: "Don't join blocks with AND",
  },
  {
    flag: "--prompt-salt <bool>",
    opt: "promptSalt",
    key: "promptSalt",
    type: "bool",
    group: "Prompt engine",
    desc: "Append a random salt number",
  },
  {
    flag: "--prompt-salt-start <n>",
    opt: "promptSaltStart",
    key: "promptSaltStart",
    type: "number",
    group: "Prompt engine",
    desc: "Incremental salt start (-1 = random)",
  },
  {
    flag: "--reload-lists <bool>",
    opt: "reloadLists",
    key: "reloadListsOnPromptChange",
    type: "bool",
    group: "Prompt engine",
    desc: "Reload lists on each new prompt",
  },
  {
    flag: "--list-entries-once <bool>",
    opt: "listEntriesOnce",
    key: "listEntriesUsedOnce",
    type: "bool",
    group: "Prompt engine",
    desc: "A list entry appears at most once",
  },
  {
    flag: "--prompt-modules <csv>",
    opt: "promptModules",
    key: "promptModules",
    type: "csv",
    group: "Prompt engine",
    desc: "Pipeline stages, in order",
  },
  {
    flag: "--hide-prompt <bool>",
    opt: "hidePrompt",
    key: "hidePrompt",
    type: "bool",
    group: "Prompt engine",
    desc: "Don't print the prompt (images only)",
  },
];

/** @type {FlagSpec[]} Provider / image-generation flags — the GUI's provider knobs. */
export const IMAGE_FLAGS = [
  {
    flag: "--sampler <name>",
    opt: "sampler",
    key: "sampler",
    type: "string",
    group: "Image",
    desc: "SD sampler name",
  },
  {
    flag: "--steps <n>",
    opt: "steps",
    key: "imageSteps",
    type: "int",
    group: "Image",
    desc: "Sampling steps",
  },
  {
    flag: "--width <n>",
    opt: "width",
    key: "imageWidth",
    type: "int",
    group: "Image",
    desc: "Image width",
  },
  {
    flag: "--height <n>",
    opt: "height",
    key: "imageHeight",
    type: "int",
    group: "Image",
    desc: "Image height",
  },
  { flag: "--cfg <f>", opt: "cfg", key: "cfg", type: "float", group: "Image", desc: "CFG scale" },
  {
    flag: "--image-seed <n>",
    opt: "imageSeed",
    key: "seed",
    type: "number",
    group: "Image",
    desc: "Provider image seed (-1 = random)",
  },
  {
    flag: "--batch <n>",
    opt: "batch",
    key: "batchSize",
    type: "int",
    group: "Image",
    desc: "Images per prompt",
  },
  {
    flag: "--negative <text>",
    opt: "negative",
    key: "negativePrompt",
    type: "string",
    group: "Image",
    desc: "Negative prompt (DPL allowed)",
  },
  {
    flag: "--restore-faces <bool>",
    opt: "restoreFaces",
    key: "restoreFaces",
    type: "bool",
    group: "Image",
    desc: "SD restore-faces",
  },
  {
    flag: "--model <name>",
    opt: "model",
    key: "model",
    type: "string",
    group: "Image",
    desc: "Provider model (hosted providers)",
  },
  {
    flag: "--size <WxH>",
    opt: "size",
    key: "size",
    type: "string",
    group: "Image",
    desc: "Provider size (hosted providers)",
  },
  {
    flag: "--provider-url <url>",
    opt: "providerUrl",
    key: "localWebuiUrl",
    type: "string",
    group: "Image",
    desc: "Local WebUI base URL",
  },
  {
    flag: "--upscale-images <bool>",
    opt: "upscaleImages",
    key: "upscaleImages",
    type: "bool",
    group: "Image",
    desc: "Upscale generated images",
  },
];

/** @type {FlagSpec[]} Rewrite / auto-fix flags. */
export const REWRITE_FLAGS = [
  {
    flag: "--rewrite-provider <id>",
    opt: "rewriteProvider",
    key: "rewriteProvider",
    type: "string",
    group: "Auto-fix",
    desc: 'Text provider for rewrites ("none" = off)',
  },
  {
    flag: "--auto-fix <bool>",
    opt: "autoFix",
    key: "autoFix",
    type: "bool",
    group: "Auto-fix",
    desc: "Prose clean-up rewrite before image gen",
  },
  {
    flag: "--auto-keyword <bool>",
    opt: "autoKeyword",
    key: "autoKeyword",
    type: "bool",
    group: "Auto-fix",
    desc: "Keyword/tag-list rewrite before image gen",
  },
];

/** All generation flags (engine + image + rewrite). */
export const ALL_FLAGS = [...ENGINE_FLAGS, ...IMAGE_FLAGS, ...REWRITE_FLAGS];

/**
 * Coerce a raw flag value per its spec type.
 * @param {string} raw The raw string value.
 * @param {string} type The spec type.
 * @returns {*} The coerced value.
 * @throws {Error} On an invalid number/bool.
 */
export function coerce(raw, type) {
  switch (type) {
    case "int": {
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n)) throw new Error(`Expected an integer, got "${raw}"`);
      return n;
    }
    case "float":
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`Expected a number, got "${raw}"`);
      return n;
    }
    case "bool":
      return parseBool(raw);
    case "csv":
      return String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return raw;
  }
}

/**
 * Parse a boolean-ish string.
 * @param {string} raw The raw value.
 * @returns {boolean} The parsed boolean.
 * @throws {Error} On an unrecognized value.
 */
export function parseBool(raw) {
  const v = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(v)) return true;
  if (["false", "0", "no", "n", "off"].includes(v)) return false;
  throw new Error(`Expected true/false, got "${raw}"`);
}

/**
 * Register every generation flag on a commander command.
 * @param {import("commander").Command} cmd The command.
 * @returns {import("commander").Command} The same command (chainable).
 */
export function addGenerationFlags(cmd) {
  for (const f of ALL_FLAGS) cmd.option(f.flag, f.desc);
  return cmd;
}

/**
 * Turn parsed commander options into a `settings` overrides object, using ONLY flags the user
 * actually passed (source === "cli"), so unspecified flags leave persisted/default values intact.
 * @param {import("commander").Command} cmd The command (for `getOptionValueSource`).
 * @param {object} opts The parsed options.
 * @returns {object} The settings overrides.
 */
export function overridesFromOptions(cmd, opts) {
  const out = {};
  for (const f of ALL_FLAGS) {
    let source;
    try {
      source = cmd.getOptionValueSource(f.opt);
    } catch {
      source = undefined;
    }
    if (source !== "cli") continue;
    out[f.key] = coerce(opts[f.opt], f.type);
  }
  return out;
}
