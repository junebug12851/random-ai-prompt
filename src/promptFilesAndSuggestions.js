/**
 * @file
 * @brief Loader-injected dynamic-prompt classifier (full vs partial) and random promptSuggestion() builder; also feeds the web file pickers. Notes: notes/reference/dynamic-prompts.md.
 */

import _ from "lodash";

import cleanup from "./prompt-modules/cleanup.js";

// Dynamic-prompt classification + random "suggestion" builder.
//
// This is loader-injected: instead of scanning the filesystem and require()-ing
// plugins itself, it reads the catalog through a loader (the same interface the
// engine uses), so it runs in Node (fs + createRequire loader) and in the browser
// (Vite import.meta.glob loader). Call `configure(loader)` once at startup before
// `loadAll()`. See notes/plans/web-migration.md and notes/reference/esm-patterns.md.

let loader = null;

function configure(_loader) {
  loader = _loader;
}

const fullRegular = [];
const fullRegularExcluded = [];
const partialRegular = [];
const userFiles = [];
const v1Files = [];
const allDynPrompts = [];

const listFiles = [];
const expansionFiles = [];

const fullDynPrompt = []; // Excludes v1 files

// Artists should always come at the end
const listFilesNoArtist = [];

// Partial prompts should not include artists
const partialNoArtistFx = [];

let settings;

function init(_settings) {
  settings = _settings;
}

function requireLoader() {
  if (!loader)
    throw new Error("promptFilesAndSuggestions: configure(loader) must be called before loadAll()");
  return loader;
}

function loadDynPromptList() {
  const l = requireLoader();

  fullRegular.length = 0;
  fullRegularExcluded.length = 0;
  partialRegular.length = 0;
  userFiles.length = 0;
  v1Files.length = 0;
  allDynPrompts.length = 0;
  fullDynPrompt.length = 0;
  partialNoArtistFx.length = 0;

  // The loader returns catalog keys relative to the dynamic-prompts root:
  //   "beach"  |  "v1/castle"  |  "user-submitted/beach-merk"
  // V1 and user-submitted prompts are always "full"; top-level ones declare it.
  for (const key of l.dynamicPromptNames()) {
    if (key.startsWith("v1/")) {
      v1Files.push(`${key.slice("v1/".length)}-v1`);
      continue;
    }
    if (key.startsWith("user-submitted/")) {
      userFiles.push(`user-${key.slice("user-submitted/".length)}`);
      continue;
    }

    const mod = l.loadDynamicPrompt(key);
    if (!mod) continue;

    const isFull = mod.full === true;
    const exclude = mod.suggestion_exclude === true;

    if (isFull) {
      fullRegular.push(key);
      if (!exclude) fullRegularExcluded.push(key);
    } else {
      partialRegular.push(key);
    }
  }

  // Partial prompts, minus artists and the fx one
  for (const name of partialRegular) {
    if (name.includes("artist")) continue;
    if (name == "fx") continue;
    partialNoArtistFx.push(name);
  }

  allDynPrompts.splice(0, 0, ...fullRegular, ...partialRegular, ...userFiles, ...v1Files);
  fullDynPrompt.splice(0, 0, ...fullRegularExcluded, ...userFiles);

  return {
    fullRegular,
    partialRegular,
    userFiles,
    v1Files,
    all: [...fullRegular, ...partialRegular, ...userFiles, ...v1Files],
  };
}

function loadExpansionFileList() {
  expansionFiles.length = 0;
  expansionFiles.push(...requireLoader().expansionNames());
  return expansionFiles;
}

function loadListFileList() {
  const l = requireLoader();
  listFiles.length = 0;
  listFilesNoArtist.length = 0;

  listFiles.push(...l.listNames());
  for (const name of listFiles) {
    if (name.includes("artist")) continue;
    listFilesNoArtist.push(name);
  }

  return listFiles;
}

function loadAll() {
  loadDynPromptList();
  loadExpansionFileList();
  loadListFileList();
}

function prePrompt(maxCount) {
  let prePrompt = "";

  // Randomly add stuff to the start of the prompt
  if (_.random(0.0, 1.0, true) < 0.25) prePrompt += `, <${_.sample(expansionFiles)}>`;

  for (let i = 0; i < maxCount; i++) {
    if (_.random(0.0, 1.0, true) < 0.25) prePrompt += `, #${_.sample(partialNoArtistFx)}`;

    if (_.random(0.0, 1.0, true) < 0.25) prePrompt += `, {${_.sample(listFilesNoArtist)}}`;
  }

  return prePrompt;
}

function promptSuggestion(full) {
  // Prepare building final prompt
  let ret = "";

  let maxOptions = full == true ? 3 : 0;
  let maxCount = full == true ? 3 : 1;

  switch (_.random(0, maxOptions, false)) {
    // Option 0: Pick 1 full dynamic prompt
    case 0:
      ret = `${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)}`;
      break;

    case 1:
      ret = `${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)} :0.75 AND ${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)} :1.1`;
      break;

    case 2:
      ret = `${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)} :0.75 AND ${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)} :1.1 AND ${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)} :0.50`;
      break;

    case 3:
      ret = `${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)}, ${prePrompt(maxCount)}, #${_.sample(fullDynPrompt)}`;
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
  loadExpansionFileList,
  loadListFileList,
  loadAll,
  promptSuggestion,
};
