const fs = require("fs");
const _ = require("lodash");

const cleanup = require("../prompt-modules/cleanup");

const fullRegular = [];
const partialRegular = [];
const userFiles = [];
const v1Files = [];
const allDynPrompts = [];

const listFiles = [];
const expansionFiles = [];

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
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));

    // Add to correct list
    if(isFull)
      fullRegular.push(file);
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

  // Add in dynamicp rompt files
  allDynPrompts.splice(0, 0, ...fullRegular, ...partialRegular, ...userFiles, ...v1Files);

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

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    listFiles.push(file);
  }

  return listFiles;
}

function loadAll() {
  loadDynPromptList();
  loadExpansionFileList();
  loadListFileList();
}

function promptSuggestion() {

  let postPrompt = "";
  let prePrompt = "";
  let fullDynPrompt = [...fullRegular, ...userFiles]; // Exclude v1 files

  // Artists should always come at the end
  let listFilesNoArtist = [];

  // Partial prompt should not include artists
  let partialNoArtistFx = [];

  for(let i = 0; i < listFiles.length; i++) {
    if(listFiles[i].includes("artist"))
      continue;

    listFilesNoArtist.push(listFiles[i]);
  }

  for(let i = 0; i < partialRegular.length; i++) {

    // Skip anything with artist in the name
    if(partialRegular[i].includes("artist"))
      continue;

    // Skip the fx one
    if(partialRegular[i] == "fx")
      continue;

    partialNoArtistFx.push(partialRegular[i]);
  }

  // Randomly add #fx
  // if(_.random(0.0, 1.0, true) < 0.2)
  //   postPrompt = ", #fx";

  // // Randomly add #artists
  // if(_.random(0.0, 1.0, true) < 0.2)
  //   postPrompt += ", #artists"

  // Randomly add stuff to the start of the prompt
  if(_.random(0.0, 1.0, true) < 0.25)
    prePrompt += `, <${_.sample(expansionFiles)}>`

  if(_.random(0.0, 1.0, true) < 0.25)
    prePrompt += `, #${_.sample(partialNoArtistFx)}`

  if(_.random(0.0, 1.0, true) < 0.25)
    prePrompt += `, {${_.sample(listFilesNoArtist)}}`

  // Prepare building final prompt
  let ret = "";

  switch(_.random(0, 0, false)) {

    // Option 0: Pick 1 full dynamic prompt
    case 0:
      ret = `${prePrompt}, #${_.sample(fullDynPrompt)}, ${postPrompt}`;
      break;
  }

  // Cleanup prompt
  ret = cleanup(ret, settings().settings, settings().imageSettings, settings().upscaleSettings);

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
