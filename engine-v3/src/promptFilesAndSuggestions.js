/**
 * @file
 * @brief Loader-injected dynamic-prompt classifier (full vs partial) and random promptSuggestion() builder; also feeds the web file pickers. Notes: notes/reference/dynamic-prompts.md.
 */

import _ from "lodash";

import cleanup from "./prompt-modules/cleanup.js";
import { isGatedList, hasNsfwToken, isGatedDynPrompt } from "./gatedLists.js";
import { hasVariantSuffix, computeButtonNames } from "./listManifest.js";

// Dynamic-prompt classification + random "suggestion" builder.
//
// This is loader-injected: instead of scanning the filesystem and require()-ing
// plugins itself, it reads the catalog through a loader (the same interface the
// engine uses), so it runs in Node (fs + createRequire loader) and in the browser
// (Vite import.meta.glob loader). Call `configure(loader)` once at startup before
// `loadAll()`. See notes/plans/web-migration.md and notes/reference/esm-patterns.md.

let loader = null;

/**
 * Inject the data loader (fs in Node, glob in the browser). Call once before `loadAll()`.
 * @param {object} _loader The loader implementation.
 * @returns {void}
 */
function configure(_loader) {
  loader = _loader;
}

const fullRegular = [];
const fullRegularExcluded = [];
const partialRegular = [];
const userFiles = [];
const v1Files = [];
const v2Files = [];
const allDynPrompts = [];

const listFiles = [];

const fullDynPrompt = []; // Excludes v1 files

// Artists should always come at the end
const listFilesNoArtist = [];

// Partial prompts should not include artists
const partialNoArtistFx = [];

let settings;

/**
 * Provide the settings accessor used during suggestion cleanup.
 * @param {Function} _settings The `settings()` accessor.
 * @returns {void}
 */
function init(_settings) {
  settings = _settings;
}

/**
 * @returns {object} The configured loader.
 * @throws {Error} If `configure()` has not been called.
 */
function requireLoader() {
  if (!loader)
    throw new Error("promptFilesAndSuggestions: configure(loader) must be called before loadAll()");
  return loader;
}

/**
 * Classify every dynamic prompt into full / partial (plus the v1 and user-submitted
 * buckets) — the lists used by `promptSuggestion()` and the web file pickers.
 * @returns {object} `{fullRegular, partialRegular, userFiles, v1Files, all}`.
 */
function loadDynPromptList() {
  const l = requireLoader();

  fullRegular.length = 0;
  fullRegularExcluded.length = 0;
  partialRegular.length = 0;
  userFiles.length = 0;
  v1Files.length = 0;
  v2Files.length = 0;
  allDynPrompts.length = 0;
  fullDynPrompt.length = 0;
  partialNoArtistFx.length = 0;

  // The loader returns catalog keys relative to the dynamic-prompts root, e.g.
  //   "v3/scene/cave"  |  "v3/user/beach-merk"  |  "v2/scene/beach"  |  "v1/castle"
  // v3 is the DEFAULT (active) catalog; v1 and v2 are FROZEN, addressed only by their path
  // prefix ({#v1/castle}, {#v2/scene/cave}) and kept out of the random-suggestion pools.
  // Active generators are stored by their SHORTEST unambiguous token (computeButtonNames —
  // basenames are unique), so a bare `{#token}` resolves by suffix.
  const activeKeys = [];
  for (const key of l.dynamicPromptNames()) {
    if (key.startsWith("v1/")) {
      v1Files.push(key); // frozen — token is the full path; {#v1/castle}
      continue;
    }
    if (key.startsWith("v2/")) {
      v2Files.push(key); // frozen — {#v2/scene/cave}
      continue;
    }
    if (key.startsWith("v3/user/")) {
      userFiles.push(`user-${key.slice("v3/user/".length)}`);
      continue;
    }
    activeKeys.push(key); // active v3 catalog
  }

  const forced = l.dynPromptForcedPrefixDirs ? l.dynPromptForcedPrefixDirs() : [];
  const buttonNames = computeButtonNames(activeKeys, forced);
  for (const key of activeKeys) {
    const mod = l.loadDynamicPrompt(key);
    if (!mod) continue;

    // v3 has no full/partial distinction — every active generator is just a "prompt". The whole
    // active set is the suggestion pool (minus any `suggestions: off`); `partialRegular` stays empty.
    const token = buttonNames[key];
    fullRegular.push(token);
    if (mod.suggestion_exclude !== true) fullRegularExcluded.push(token);
  }

  // Partial prompts, minus artists and the fx one
  for (const name of partialRegular) {
    if (name.includes("artist")) continue;
    if (name == "fx") continue;
    partialNoArtistFx.push(name);
  }

  allDynPrompts.splice(
    0,
    0,
    ...fullRegular,
    ...partialRegular,
    ...userFiles,
    ...v1Files,
    ...v2Files,
  );
  fullDynPrompt.splice(0, 0, ...fullRegularExcluded, ...userFiles);

  return {
    fullRegular,
    partialRegular,
    userFiles,
    v1Files,
    v2Files,
    all: [...fullRegular, ...partialRegular, ...userFiles, ...v1Files, ...v2Files],
  };
}

/**
 * Load the list names (and cache the artist-excluded subset).
 * @returns {string[]} The list names.
 */
function loadListFileList() {
  const l = requireLoader();
  listFiles.length = 0;
  listFilesNoArtist.length = 0;

  listFiles.push(...l.listNames());
  for (const name of listFiles) {
    if (name.includes("artist")) continue;
    // Skip explicit `-sfw`/`-nsfw` variants: the random pool draws only the bare base
    // name, which already resolves SFW (adult off) or SFW+NSFW (adult on). This avoids
    // double-weighting a base against its variants. (A standalone `-nsfw` list with no
    // base is dropped here too; it is reachable only by its explicit gated name.)
    if (hasVariantSuffix(name)) continue;
    listFilesNoArtist.push(name);
  }

  return listFiles;
}

/**
 * The list names to show in the web picker, honoring adult mode. When adult is off,
 * every name carrying an `nsfw` token is hidden (the app behaves as if it doesn't
 * exist). When on, each base that has a `<base>-nsfw` sibling also offers the explicit
 * `<base>-sfw` reference, so the picker shows all three (default / SFW-only / NSFW).
 * @returns {string[]} The picker-facing list names, in load order.
 */
function pickerListNames() {
  const names = requireLoader().listNames(); // logical names (base + -sfw/-nsfw variants)
  // Reserved wildcard: {keyword} draws from all loaded vocabulary. Offered as a
  // first-class button (its -sfw/-nsfw variants follow the same mode rules as files).
  if (adultAllowed()) return ["keyword", "keyword-sfw", "keyword-nsfw", ...names];
  // Adult off: behave as if NSFW doesn't exist. Hide every `-nsfw` name and the
  // redundant `-sfw` variants, leaving just the bare/default names (which are SFW).
  return ["keyword", ...names.filter((n) => !hasNsfwToken(n) && !hasVariantSuffix(n))];
}

/**
 * Load the dynamic-prompt and list catalogs.
 * @returns {void}
 */
function loadAll() {
  loadDynPromptList();
  loadListFileList();
}

/**
 * Build a random garnish of `<expansion>` / `#partial` / `{list}` tokens to prefix
 * a suggestion (each added at ~25% chance).
 * @param {number} maxCount How many garnish rounds to roll.
 * @returns {string} The garnish string.
 */
/**
 * @returns {boolean} Whether adult/explicit lists and prompts are enabled.
 */
function adultAllowed() {
  const ctx = settings ? settings() : {};
  return !!(ctx.settings && ctx.settings.includeAdult === true);
}

/**
 * Drop gated (adult) names from a pool unless `includeAdult` is on.
 * @param {string[]} names The candidate names.
 * @param {function(string): boolean} isGated Predicate: true if a name is adult-gated.
 * @returns {string[]} The filtered pool.
 */
function gatePool(names, isGated) {
  return adultAllowed() ? names : names.filter((n) => !isGated(n));
}

function prePrompt(maxCount) {
  let prePrompt = "";

  const partialPool = gatePool(partialNoArtistFx, isGatedDynPrompt);
  const listPool = gatePool(listFilesNoArtist, isGatedList);

  // Garnish with a few partial generators and lists (each ~25%). Pools may be empty (v3 has no
  // partials; expansions are unified into generators), so guard every sample.
  for (let i = 0; i < maxCount; i++) {
    if (partialPool.length && _.random(0.0, 1.0, true) < 0.25)
      prePrompt += `, {#${_.sample(partialPool)}}`;

    if (listPool.length && _.random(0.0, 1.0, true) < 0.25)
      prePrompt += `, {${_.sample(listPool)}}`;
  }

  return prePrompt;
}

/**
 * Build a random prompt suggestion (the engine behind `#random`): one to three full
 * dynamic prompts, sometimes AND-weighted, with optional garnish, then cleaned up.
 * @param {boolean} [full] Use the richer multi-prompt form.
 * @returns {string} The suggested prompt.
 */
function promptSuggestion(full) {
  // Prepare building final prompt
  let ret = "";

  // Keep gated (adult) dynamic prompts out unless explicitly enabled
  const fullPool = gatePool(fullDynPrompt, isGatedDynPrompt);

  let maxOptions = full == true ? 3 : 0;
  let maxCount = full == true ? 3 : 1;

  switch (_.random(0, maxOptions, false)) {
    // Option 0: Pick 1 full dynamic prompt
    case 0:
      ret = `${prePrompt(maxCount)}, {#${_.sample(fullPool)}}`;
      break;

    case 1:
      ret = `${prePrompt(maxCount)}, {#${_.sample(fullPool)}} :0.75 AND ${prePrompt(maxCount)}, {#${_.sample(fullPool)}} :1.1`;
      break;

    case 2:
      ret = `${prePrompt(maxCount)}, {#${_.sample(fullPool)}} :0.75 AND ${prePrompt(maxCount)}, {#${_.sample(fullPool)}} :1.1 AND ${prePrompt(maxCount)}, {#${_.sample(fullPool)}} :0.50`;
      break;

    case 3:
      ret = `${prePrompt(maxCount)}, {#${_.sample(fullPool)}}, ${prePrompt(maxCount)}, {#${_.sample(fullPool)}}`;
      break;
  }

  // Cleanup prompt (image/upscale settings are optional here)
  const ctx = settings ? settings() : {};
  ret = cleanup(ret, ctx.settings, ctx.imageSettings, ctx.upscaleSettings);

  // Somehow this still slips through, this time, explicitly search for it
  ret = ret.replaceAll("AND,", "AND");

  return ret;
}

export default {
  configure,
  init,
  loadDynPromptList,
  loadListFileList,
  pickerListNames,
  loadAll,
  promptSuggestion,
};
