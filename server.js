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

console.log("Starting server...");

const express = require('express')
const app = express()

// Use the body-parser middleware to parse incoming request bodies
app.use(express.json());

// Announce API is ready
app.listen(settings().serverSettings.port, () => {
  console.log(`Done!`);
  console.log(`API is listening on http://localhost:${settings().serverSettings.port}`);
});

// Ping/Pong
app.get('/', (req, res) => {
  res.send('Pong');
});

app.get('/ping', (req, res) => {
  res.send('Pong');
});

// Get settings
app.get('/settings', (req, res) => {
  res.send(JSON.stringify(settings(), null, 4));
});

app.get('/default-settings', (req, res) => {
  res.send(JSON.stringify(defSettings(), null, 4));
});

app.get('/user-settings', (req, res) => {
  res.send(JSON.stringify(userSettings(), null, 4));
});

// Reload settings
app.get('/reload-settings', (req, res) => {
  reloadSettings();
  res.send("Done");
});

// Save settings
app.get('/save-settings', (req, res) => {
  saveSettings();
  res.send("Done");
});

// Put settings
app.post('/replace-settings', (req, res) => {

  // Change out settings
  replaceSettings(req.body);

  // Save settings
  saveSettings();

  res.send("Done");
});

// Put settings
app.post('/merge-settings', (req, res) => {

  // Merge settings
  _.merge(settings(), req.body);

  // Save settings
  saveSettings();

  res.send("Done");
});

// Make file variations
app.get('/file-variation/:fileId', async (req, res) => {

  // Save settings beforehand
  saveSettings();

  // Load variation data
  require("./src/loadVariationData")(
        req.params.fileId,
        settings().settings,
        settings().imageSettings,
        settings().upscaleSettings);

  // Make variations
  await run();

  // Undo settings change
  reloadSettings();

  res.send("Done");
});

// Upscale existing
app.get('/upscale-file/:fileId', async (req, res) => {

  // Save settings beforehand
  saveSettings();

  // Do upscale
  await upscale(req.params.fileId);

  // Undo settings change
  reloadSettings();

  res.send("Done");
});

// Do normal generation
app.get('/generate', async (req, res) => {

  // Generate
  await run();

  res.send("Done");
});
