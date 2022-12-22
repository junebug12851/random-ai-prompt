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

// Rebuild indexes
imageIndex.rebuildIndexes(settings());

console.log("Starting server...");

const app = express();

// Use the body-parser middleware to parse incoming request bodies
app.use(express.json());

// Announce API is ready
app.listen(settings().serverSettings.port, () => {
  console.log(`Done!`);
  console.log(`Visit http://localhost:${settings().serverSettings.port}`);
});

// Linkup images to the output folder
app.use("/images", express.static(settings().imageSettings.saveTo));

// Add program icons to root for browser access
app.use("/", express.static("./assets/icons"));

// Linkup web content to the web folder
app.use(express.static(settings().serverSettings.webFolder + "/frontend"));

// API Requests
// These respond in JSON and sometimes require JSON input

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