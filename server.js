/*
    Copyright 2022 juenbug12851

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

console.log("Starting app...");

const _ = require("lodash");
const {
  settings,
  defSettings,
  reloadSettings,
  saveSettings,
  replaceSettings,
  userSettings,

  genImage,
  upscale,
  run,
} = require("./common");

const imageIndex = require("./web/backend/indexImages");
const fs = require("fs");
const express = require('express');
const http = require('http');
const fetch = require('node-fetch');
const open = require('open');
const saveApng = require('./helpers/saveApng');

const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

const promptFiles = require("./src/promptFilesAndSuggestions");
promptFiles.init(settings);
promptFiles.loadAll();

// Rebuild indexes
imageIndex.rebuildIndexes(settings());

console.log("Starting server...");

const app = express();

// Use pug as the template engine
app.set('view engine', 'pug');
app.set('views', settings().serverSettings.webFolder + "/views")

// Use the body-parser middleware to parse incoming request bodies
app.use(express.json());

// Executes index.js with with currently set args
// await exec();

let args = {};
let execAppOngoing = false;

async function execApp() {
  const command = ".";
  const nodeExecutable = `"${process.argv[0]}"`;
  const commandArgs = [nodeExecutable, command];

  execAppOngoing = true;

  let ret = {};

  for (const [key, value] of Object.entries(args)) {

    commandArgs.push(`--${key}`);

    if (value !== undefined && value !== true) {
      if(typeof value === 'string' && value.includes(' '))
        commandArgs.push(`"${value}"`);
      else
        commandArgs.push(value);
    }
  }

  // Log cmd used
  let logCmd = commandArgs.join(' ');
  logCmd = logCmd.replace(nodeExecutable, "node");
  console.log(logCmd);

  try {
    const { stdout, stderr } = await execPromise(commandArgs.join(' '));
    ret = {stdout, stderr};
  } catch (error) {
    ret = {error};
    console.error(`exec error: ${error}`);
  }

  execAppOngoing = false;

  return ret;
}

async function getProgressRequest() {
    const url = `http://localhost:${settings().serverSettings.portProgress}/api/images/progress`;

    // Send response
    try {
      const response = await fetch(`http://localhost:${settings().serverSettings.portProgress}/api/images/progress`);
      return await response.json();
    }
    catch(err) {}

    return undefined;
}

async function getProgress() {
  let ret;

  try {
    ret = await getProgressRequest();
  } catch (error) {}

  if(ret == undefined) {
    ret = {
      // Progress on-going or not
      progressOngoing: false,

      // Image Progress
      progressCurStep: 1,
      progressTotalSteps: 1,

      // Image Batch Progress
      progressCurImg: 1,
      progressTotalImg: 1,

      // Image Total Progress
      progressPercent: 1,
      progressEta: "--s",

      // Prompts Progress
      progressCurPrompt: 1,
      progressTotalPrompts: 1,
    };
  }

  // Whether the actual request is done
  ret.execOngoing = execAppOngoing;

  return ret;
}

// Announce API is ready
app.listen(settings().serverSettings.port, () => {
  console.log(`Done!`);
  console.log(`Visit http://localhost:${settings().serverSettings.port}`);

  // Auto-opens browser
  open(`http://localhost:${settings().serverSettings.port}`);
});

// Linkup images to the output folder
app.use("/images", express.static(settings().imageSettings.saveTo));

// Add program icons to root for browser access
app.use("/", express.static("./assets/icons"));

// Make all assets accessible
app.use("/assets", express.static("./assets"));

// Linkup web content to the web folder
app.use(express.static(settings().serverSettings.webFolder + "/frontend"));

// API Requests
// These respond in JSON and sometimes require JSON input

app.get('/', (req, res) => {
  res.render('feed');
});

app.get('/single', (req, res) => {
  res.render('single');
});

app.get('/re-index', (req, res) => {
  res.render('re-index');
});

app.get('/progress', (req, res) => {
  res.render('progress');
});

app.get('/upscale-progress', (req, res) => {
  res.render('upscale-progress');
});

app.get('/results', (req, res) => {
  res.render('results');
});

app.get('/settings', (req, res) => {
  res.render('settings');
});

app.get('/generate', (req, res) => {
  res.render('generate');
});

app.get('/regen-anim', (req, res) => {
  res.render('regen-anim');
});

app.get('/download/:file', (req, res) => {
  res.download(`./${settings().imageSettings.saveTo}/${req.params.file}`);
});

app.get('/api/images/delete/:filename', (req, res) => {

  // Delete file
  try {
    fs.unlinkSync(`./${settings().imageSettings.saveTo}/${req.params.filename}.png`);
    fs.unlinkSync(`./${settings().imageSettings.saveTo}/${req.params.filename}.json`);
  }
  catch(err) {}

  // Mark as success
  res.jsonp("success");
});

app.get('/api/animation/delete/:fileId', (req, res) => {

  // Get image name
  const imageName = req.params.fileId;

  // Get image data
  const imageData = _.cloneDeep(imageIndex.getFiles()[imageName]);

  // Make sure image exists in index
  if(imageData === undefined) {
    res.jsonp({});
    console.error("Error: API requested a non-indexed image");
    return;
  }

  // Make sure it has at least 1 animation frame
  if(imageData.animationFrames == undefined || imageData.animationFrames.length == 0) {
    res.jsonp({});
    console.error("Error: API requested to remove animation frames from an image with no frames");
    return;
  }

  // Go through all frames
  for(let i = 0; i < imageData.animationFrames.length; i++) {

    // Get file name
    const file = imageData.animationFrames[i].name;

    // Delete file
  try {
      fs.unlinkSync(`./${settings().imageSettings.saveTo}/${file}.png`);
      fs.unlinkSync(`./${settings().imageSettings.saveTo}/${file}.json`);
    }
    catch(err) {}
  }

  // Mark as success
  res.jsonp("success");
});

app.get('/api/images/query', async function(req, res) {

  // Get query
  const query = req.query;

  if(query.query == undefined) {
    res.jsonp([]);
    console.error("Client sent a query request with no query attached");
    return;
  }

  // Do a query
  const results = imageIndex.query(query.query);

  res.jsonp(results);
});

// Gets a random image name
app.get('/api/images/random-name', async function(req, res) {

  const file = _.sample(imageIndex.getFiles());

  if(file == undefined) {
    res.jsonp("");
    return;
  }

  res.jsonp(_.sample(imageIndex.getFiles()).name);
});

app.get('/api/images/single/:name', async function(req, res) {

  // Get image name
  const imageName = req.params.name;

  // Get image data
  const imageData = _.cloneDeep(imageIndex.getFiles()[imageName]);

  // Make sure image exists in index
  if(imageData === undefined) {
    res.jsonp({});
    console.error("Error: API requested a non-indexed image");
    return;
  }

  // Get index stats
  const stats = imageIndex.getIndexStats();

  // Get max number to compare keyword popularity percent to
  const keywordTotalCount = stats._total.highestKeywordCount;

  // Get image keyword list and sort it alphabetically
  const imageKeywords = _.sortBy(imageData.keywords);

  // Begin working on the keyword cloud
  const keywordCloud = [];

  for(let i = 0; i < imageKeywords.length; i++) {

    // Get keyword
    const imageKeyword = imageKeywords[i];

    // Get count
    let keywordStats = stats[imageKeyword];
    if(keywordStats == undefined)
      continue;
    keywordStats = keywordStats.count;

    // Calc percent
    const keywordPercent = keywordStats / keywordTotalCount;

    // Push to keyword cloud
    keywordCloud.push({
      keyword: imageKeyword,
      count: keywordStats,
      percent: keywordPercent
    })
  }

  // Save to object
  imageData.keywordCloud = keywordCloud;

  // Send object back
  res.jsonp(imageData);
});

// Returns all images shuffled randomly
app.get('/api/images/feed', async function(req, res) {
  res.jsonp(_.shuffle(_.uniqBy(_.values(imageIndex.getFiles()), "imgPath")));
});

// Rebuilds index
app.get('/api/images/re-index', async function(req, res) {
  imageIndex.rebuildIndexes(settings());
  res.jsonp("success");
});

// Returns all images unshuffled
app.get('/api/images/files', async function(req, res) {
  res.jsonp(imageIndex.getFiles());
});

// Returns all keywords unshuffled
app.get('/api/images/index', async function(req, res) {
  res.jsonp(imageIndex.getIndex());
});

app.get('/api/images/stats', async function(req, res) {
  res.jsonp(imageIndex.getIndexStats());
});

// Returns random keyword suggestions with 1 to 3 keywords
app.get('/api/images/search-suggestion', async function(req, res) {

  // Whether to pull from a file 1-3 keywords or 1 random keyword
  const fromFile = _.random(0.0, 1.0, true) < 0.50;

  // How many to pull (if from file)
  const count = _.random(1, 3, false);

  if(fromFile) {
    const file = _.sample(_.values(imageIndex.getFiles()));

    if(file == undefined) {
      res.jsonp("Please make some images by clicking new...");
      return;
    }

    const keywords = _.sampleSize(file.keywords, count);
    res.jsonp(keywords.join(" "));
  }
  else {
    const keyword = _.sample(_.keys(imageIndex.getIndex()));

    if(keyword == undefined) {
      res.jsonp("Please make some images by clicking new...");
      return;
    }

    res.jsonp(keyword);
  }
});

app.get('/api/images/progress', async function(req, res) {
  const progress = await getProgress();
  res.jsonp(progress);
});

app.get('/api/images/reindex-progress', async function(req, res) {
  res.jsonp(imageIndex.getProgress());
});

app.get('/api/results', async function(req, res) {

  try {

    // get results
    const results = JSON.parse(fs.readFileSync("./results.json").toString());

    // Breakdown results into images and prompts
    const images = results.images;
    const prompts = results.prompts;

    // Array to send to client
    let ret = {
      images: [],
      prompts: (prompts) ? prompts : [],
    };

    if(images != undefined) {
      for(let i = 0; i < images.length; i++) {

        // Prepare object to be pushed into array
        const obj = {};

        // get path to png file
        obj.image = `/images/${images[i]}.png`;

        // Save reference to index data and index link if it exists
        const data = imageIndex.getFiles()[images[i]];
        if(data != undefined) {
          obj.data = data;
          obj.link = `/single?name=${images[i]}`;
        }

        // Otherwise attempt to assume its an upscale and get link that way
        else {
          const json = require(`${settings().imageSettings.saveTo}/${images[i]}.json`);
          if(json.upscaleOf) {
            obj.data = imageIndex.getFiles()[json.upscaleOf];
            obj.link = `/single?name=${json.upscaleOf}`;
          }
        }

        // Save it
        ret.images.push(obj);
      }
    }

    res.jsonp(ret);
    return;
  }
  catch(err) {}

  res.jsonp({
      images: [],
      prompts: [],
    });
});

app.get('/api/ping', (req, res) => {
  res.jsonp('pong');
});

// Single setting
// app.get('/api/setting/:path', (req, res) => {
//   const setting = _.at(settings(), req.params.path);
//   if(setting == null || setting == undefined || setting.length == 0) {
//     res.jsonp(null);
//     return;
//   }

//   res.jsonp(setting[0]);
// });

app.post('/api/setting', (req, res) => {

  // Verify the body contains an object with a kery of value and a value of anything but undefined
  if(req.body == null || req.body == undefined || req.body.value == undefined || req.body.path == undefined) {
    console.error("Posting a setting needs to be done in {value: ..., path: ...}");
    res.jsonp(null);
    return;
  }

  _.set(settings(), req.body.path, req.body.value);

  saveSettings();
  res.jsonp("success");
});

// Get settings
app.get('/api/settings', (req, res) => {
  res.jsonp(settings());
});

app.get('/api/default-settings', (req, res) => {
  res.jsonp(defSettings());
});

app.get('/api/user-settings', (req, res) => {
  res.jsonp(userSettings());
});

// Reload settings
app.get('/api/reload-settings', (req, res) => {
  reloadSettings();
  res.jsonp("success");
});

// Save settings
app.get('/api/save-settings', (req, res) => {
  saveSettings();
  res.jsonp("success");
});

// Put settings
app.post('/api/replace-settings', (req, res) => {

  // Change out settings
  replaceSettings(req.body);

  // Save settings
  saveSettings();

  res.jsonp("success");
});

// Put settings
app.post('/api/merge-settings', (req, res) => {

  // Merge settings
  _.merge(settings(), req.body);

  // Save settings
  saveSettings();

  res.jsonp("success");
});

// Make file variations
app.get('/api/file-variation/:fileId', async (req, res) => {

  args = {
    "file-variations": req.params.fileId
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

// Upscale existing
app.get('/api/upscale-file/:fileId', async (req, res) => {

  args = {
    "upscale-file": req.params.fileId
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

// Reroll existing
app.get('/api/reroll-file/:fileId/:field', async (req, res) => {

  args = {
    "reroll-file": req.params.fileId,
    "reroll-field": req.params.field,
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

// Make file variations
app.get('/api/file-update-animation/:fileId', async (req, res) => {

  // Get image name
  const imageName = req.params.fileId;

  // Get image data
  const imageData = _.cloneDeep(imageIndex.getFiles()[imageName]);

  // Make sure image exists in index
  if(imageData === undefined) {
    res.jsonp({});
    console.error("Error: API requested a non-indexed image");
    return;
  }

  // Make sure it has at least 1 animation frame
  if(imageData.animationFrames == undefined || imageData.animationFrames.length == 0) {
    res.jsonp({});
    console.error("Error: API requested to update an image with no frames");
    return;
  }

  // Convert to filename list
  const files = [];

  for(let i = 0; i < imageData.animationFrames.length; i++) {
    files.push(imageData.animationFrames[i].name);
  }

  // Set animation of
  settings().imageSettings.animationOf = imageName;

  // Re-update animated image and skip writing json file
  saveApng(files, settings().imageSettings, true);

  // Clear animation of
  delete settings().imageSettings.animationOf;

  // Return
  res.jsonp("success");
});

// Do normal generation
app.get('/api/generate', async (req, res) => {

  args = {
    "generate-images": undefined
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

app.post('/api/generate', async (req, res) => {

  args = {
    "generate-images": undefined
  };

  if(req.body != null &&
      req.body != undefined &&
      req.body.value != undefined &&
      req.body.value != "")
    args.prompt = req.body.value;

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

app.post('/api/generate-full', async (req, res) => {

  args = {
    "generate-images": undefined
  };

  if(req.body != null &&
      req.body != undefined)
    args = req.body;

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

app.get('/api/prompt-suggestion', (req, res) => {
  res.jsonp(promptFiles.promptSuggestion());
});

app.get('/api/files/dynamic-prompts', (req, res) => {
  res.jsonp(promptFiles.loadDynPromptList());
});

app.get('/api/files/expansions', (req, res) => {
  res.jsonp(promptFiles.loadExpansionFileList());
});

app.get('/api/files/lists', (req, res) => {
  res.jsonp(promptFiles.loadListFileList());
});

app.get('/api/files/presets', (req, res) => {
  const files = fs.readdirSync(settings().settings.presetFiles);
  const userFiles = [];

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    userFiles.push(file);
  }

  res.jsonp(userFiles);
});
