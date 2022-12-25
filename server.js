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

const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

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

async function execApp() {
  const command = ".";
  const nodeExecutable = `"${process.argv[0]}"`;
  const commandArgs = [nodeExecutable, command];

  let ret = {};

  for (const [key, value] of Object.entries(args)) {
    commandArgs.push(`--${key}`);
    if (value !== undefined) {
      commandArgs.push(value);
    }
  }

  try {
    const { stdout, stderr } = await execPromise(commandArgs.join(' '));
    ret = {stdout, stderr};
  } catch (error) {
    ret = {error};
    console.error(`exec error: ${error}`);
  }

  return ret;
}

async function getProgress() {
  try {
    return await http.get(`http://localhost:${settings().serverSettings.portProgress}`);
  } catch (error) {
    console.error(error);
    return {};
  }
}

// Announce API is ready
app.listen(settings().serverSettings.port, () => {
  console.log(`Done!`);
  console.log(`Visit http://localhost:${settings().serverSettings.port}`);
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

app.get('/api/images/query', async function(req, res) {

  // Get query
  const query = req.query;

  if(query.query == undefined) {
    res.jsonp([]);
    cosnole.error("Client sent a query request with no query attached");
  }

  // Do a query
  const results = imageIndex.query(query.query);

  res.jsonp(results);
});

// Gets a random image name
app.get('/api/images/random-name', async function(req, res) {
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
    const keywords = _.sampleSize(file.keywords, count);

    res.jsonp(keywords.join(" "));
  }
  else {
    const keyword = _.sample(_.keys(imageIndex.getIndex()));
    res.jsonp(keyword);
  }
});

app.get('/api/ping', (req, res) => {
  res.jsonp('pong');
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

  // Save settings beforehand
  saveSettings();

  args = {
    "file-variations": req.params.fileId
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

// Upscale existing
app.get('/api/upscale-file/:fileId', async (req, res) => {

  // Save settings beforehand
  saveSettings();

  args = {
    "upscale-file": req.params.fileId
  };

  // Run file variatons
  await execApp();

  res.jsonp("success");
});

app.get('/api/download-file/:name', async (req, res) => {

  // Get image name
  const imageName = req.params.name;

  // get image data
  const imageData = imageIndex.getFiles()[imageName];

  // Prompt to download image
  res.download(`./${settings().imageSettings.saveTo}/${imageData.imgPathReal}`);
});

// Do normal generation
app.get('/api/generate', async (req, res) => {

  // Generate
  await run();

  res.jsonp("success");
});

app.get('/api/generate/:prompt', async (req, res) => {

  // Get prompt
  const prompt = req.params.prompt;

  // Swap prompts
  const origPrompt = settings().settings.prompt;
  settings().settings.prompt = prompt;

  // Generate
  await run();

  settings().settings.prompt = origPrompt;

  res.jsonp("success");
});

app.get('/api/files/dynamic-prompts', (req, res) => {

  // Regular Dynamic Prompts

  let files = fs.readdirSync(settings().settings.dynamicPromptFiles);
  const userFiles = [];

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    userFiles.push(file);
  }

  // User Submitted Dynamic Prompts

  files = fs.readdirSync(`${settings().settings.dynamicPromptFiles}/user-submitted`);

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    let file = files[i].substr(0, files[i].lastIndexOf('.'));
    file = `user-${file}`;
    userFiles.push(file);
  }

  // Version 1 dynamic prompts

  files = fs.readdirSync(`${settings().settings.dynamicPromptFiles}/v1`);

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    let file = files[i].substr(0, files[i].lastIndexOf('.'));
    file = `${file}-v1`;
    userFiles.push(file);
  }

  res.jsonp(userFiles);
});

app.get('/api/files/expansions', (req, res) => {

  const files = fs.readdirSync(settings().settings.expansionFiles);
  const userFiles = [];

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    userFiles.push(file);
  }

  res.jsonp(userFiles);
});

app.get('/api/files/lists', (req, res) => {

  const files = fs.readdirSync(settings().settings.listFiles);
  const userFiles = [];

  for(let i = 0; i < files.length; i++) {
    
    // Get filename without suffix
    const file = files[i].substr(0, files[i].lastIndexOf('.'));
    userFiles.push(file);
  }

  res.jsonp(userFiles);
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

app.get('/api/apply-preset/:fileId', (req, res) => {

  // Load it
  const presetData = require(`./${settings().settings.presetFiles}/${req.params.fileId}.json`);

  // Merge it
  _.merge(settings(), presetData);

  // Notify Done
  res.jsonp("success");
});

app.get('/api/apply-chaos/:value', (req, res) => {

  const chaosPercent = parseFloat(req.params.value);

  settings().settings.emphasisChance *= chaosPercent;
  settings().settings.emphasisLevelChance *= chaosPercent;
  settings().settings.emphasisMaxLevels = Math.round(settings().settings.emphasisMaxLevels * chaosPercent);

  settings().settings.deEmphasisChance *= chaosPercent;
  if(settings().settings.deEmphasisChance < 0.25)
    settings().settings.deEmphasisChance = 0.25;
  else if(settings().settings.deEmphasisChance > 0.50)
    settings().settings.deEmphasisChance = 0.50;
  
  settings().settings.keywordAlternatingMaxLevels *= chaosPercent;

  // Notify Done
  res.jsonp("success");
});
