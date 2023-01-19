const fs = require("fs");
const _ = require("lodash");

const cleanup = require("../prompt-modules/cleanup");

const fullRegular = [];
const fullRegularExcluded = [];
const partialRegular = [];
const userFiles = [];
const v1Files = [];
const allDynPrompts = [];

const listFiles = [];
const expansionFiles = [];

const fullDynPrompt = []; // Exclude v1 files

// Artists should always come at the end
const listFilesNoArtist = [];

// Partial prompt should not include artists
const partialNoArtistFx = [];

let settings;

function init(_settings) {
  settings = _settings;
}

function loadDynPromptList() {
  // Regular Dynamic Prompts

  let files = fs.readdirSync(settings().settings.dynamicPromptFiles);

  // There are 2 types of regular dynamic prompts
  // Ones that provide a full prompt, and ones that provide a partial prompt
  // V1 prompts and user submitted prompts are always full prompts
  fullRegular.length = 0;
  partialRegular.length = 0;
  userFiles.length = 0;
  v1Files.length = 0;
  allDynPrompts.length = 0;
  fullDynPrompt.length = 0;
  partialNoArtistFx.length = 0;

  for(let i = 0; i < files.length; i++) {

    // Skip over non-js files or folders
    try {
      require(`../${settings().settings.dynamicPromptFiles}/${files[i]}`);
    }
    catch(err) {
      continue;
    }

    // Load it to read whether it's full or not
    const isFull = require(`../${settings().settings.dynamicPromptFiles}/${files[i]}`).full == true;
    const exclude = require(`../${settings().settings.dynamicPromptFiles}/${files[i]}`).suggestion_exclude == true;
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));

    // Add to correct list
    if(isFull) {
      fullRegular.push(file);

      if(!exclude)
        fullRegularExcluded.push(file);
    }
    else
      partialRegular.push(file);
  }

  // User Submitted Dynamic Prompts

  files = fs.readdirSync(`${settings().settings.dynamicPromptFiles}/user-submitted`);

  for(let i = 0; i < files.length; i++) {

    // Skip over non-js files or folders
    try {
      require(`../${settings().settings.dynamicPromptFiles}/user-submitted/${files[i]}`);
    }
    catch(err) {
      continue;
    }
    
    // Get filename without suffix
    let file = files[i].substr(0, files[i].lastIndexOf('.'));
    file = `user-${file}`;
    userFiles.push(file);
  }

  // Version 1 dynamic prompts

  files = fs.readdirSync(`${settings().settings.dynamicPromptFiles}/v1`);

  for(let i = 0; i < files.length; i++) {

    // Skip over non-js files or folders
    try {
      require(`../${settings().settings.dynamicPromptFiles}/v1/${files[i]}`);
    }
    catch(err) {
      continue;
    }
    
    // Get filename without suffix
    let file = files[i].substr(0, files[i].lastIndexOf('.'));
    file = `${file}-v1`;
    v1Files.push(file);
  }

  // Filter out partial prompts
  for(let i = 0; i < partialRegular.length; i++) {

    // Skip anything with artist in the name
    if(partialRegular[i].includes("artist"))
      continue;

    // Skip the fx one
    if(partialRegular[i] == "fx")
      continue;

    partialNoArtistFx.push(partialRegular[i]);
  }

  // Add in dynamicp rompt files
  allDynPrompts.splice(0, 0, ...fullRegular, ...partialRegular, ...userFiles, ...v1Files);

  // Add in Non V1 full Dynamic Prompts
  fullDynPrompt.splice(0, 0, ...fullRegularExcluded, ...userFiles);

  return {
    fullRegular,
    partialRegular,
    userFiles,
    v1Files,
    all: [...fullRegular, ...partialRegular, ...userFiles, ...v1Files]
  };
}

function loadExpansionFileList() {

  const files = fs.readdirSync(settings().settings.expansionFiles);
  expansionFiles.length = 0;

  for(let i = 0; i < files.length; i++) {

    // Skip over non-text files
    if(!files[i].endsWith(".txt"))
      continue;
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    expansionFiles.push(file);
  }

  return expansionFiles;
}

function loadListFileList() {
  const files = fs.readdirSync(settings().settings.listFiles);
  listFiles.length = 0;
  listFilesNoArtist.length = 0;

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    listFiles.push(file);
  }

  for(let i = 0; i < listFiles.length; i++) {
    if(listFiles[i].includes("artist"))
      continue;

    listFilesNoArtist.push(listFiles[i]);
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
  if(_.random(0.0, 1.0, true) < 0.25)
    prePrompt += `, <${_.sample(expansionFiles)}>`

  for(let i = 0; i < maxCount; i++) {
    if(_.random(0.0, 1.0, true) < 0.25)
      prePrompt += `, #${_.sample(partialNoArtistFx)}`

    if(_.random(0.0, 1.0, true) < 0.25)
      prePrompt += `, {${_.sample(listFilesNoArtist)}}`
  }

  return prePrompt;
}

function postPrompt() {
  let prePrompt = "";

  // Randomly add stuff to the start of the prompt
  if(_.random(0.0, 1.0, true) < 0.5)
    prePrompt += `, #fx`

  if(_.random(0.0, 1.0, true) < 0.5)
    prePrompt += `, #artists`

  return prePrompt;
}

function promptSuggestion(full) {

  // Prepare building final prompt
  let ret = "";

  let maxOptions = (full == true) ? 3 : 0;
  let maxCount = (full == true) ? 3 : 1;

  switch(_.random(0, maxOptions, false)) {

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

  // Cleanup prompt
  ret = cleanup(ret, settings().settings, settings().imageSettings, settings().upscaleSettings);

  // Somehow this still slips through, this time, explicitly search for it
  ret = ret.replaceAll("AND,", "AND");

  // Return
  return ret;
}

module.exports = {
  init,
  loadDynPromptList,
  loadExpansionFileList,
  loadListFileList,
  loadAll,
  promptSuggestion
};
