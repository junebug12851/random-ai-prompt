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

// Ensure we're within this directory
process.chdir(__dirname);

// Enviroment
const env = process.env;

const isServer = (process.env.server != undefined);

// Load imports
const fs = require('fs');
const _ = require("lodash");
const yargs = require('yargs/yargs')

// Process given arguments
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

// Ensure user-settings is created
require("./src/createMissingUserSettings")();

// Import settings differ
const diffSettings = require("./src/diffSettings");

// Load settings
const basicSettings = require("./settings");
const imageSettings = require("./image-settings");
const upscaleSettings = require("./upscale-settings");
const serverSettings = require("./server-settings");

// Load user settings
const userSettings = require("./user-settings.json");

// Add whether we're runing inside a server or not
basicSettings.isServer = isServer;

// Combine them into a single object
// We use deep-clone to prevent the mfrom being modified
// This also prevents a bug where converting legacy settings which modifies these files
// therefore also modies this copy
const defSettings = _.cloneDeep({
    settings: basicSettings,
    imageSettings,
    upscaleSettings,
    serverSettings,
});

// Create a clone that can be mofied and easly changed back
let settings;

function reloadSettings() {
    settings = _.cloneDeep(defSettings);
}

reloadSettings();

// Merge user settings into main settings
if(userSettings.settings != undefined)
    _.merge(settings.settings, userSettings.settings);

if(userSettings.imageSettings != undefined)
    _.merge(settings.imageSettings, userSettings.imageSettings);

if(userSettings.upscaleSettings != undefined)
    _.merge(settings.upscaleSettings, userSettings.upscaleSettings);

if(userSettings.serverSettings != undefined)
    _.merge(settings.serverSettings, userSettings.serverSettings);

// Merge legacy user-settings.js
try {
    // Import legacy settings
    const legacySettings = require("./user-settings.js");

    console.log("Found old user-settings.js, converting to user-settings.json...");

    // Do a diff on it to extract the actual changes
    const legacyDiff = diffSettings(legacySettings, defSettings);

    // Merge changes in
    _.merge(settings, legacyDiff);

    // Remove legacy file
    fs.unlinkSync("./user-settings.js");
}
catch(err) {}

// Save User Settings
function saveUserSettings() {
    const diff = diffSettings(settings, defSettings);
    fs.writeFileSync("./user-settings.json", JSON.stringify(diff, null, 4));
}

saveUserSettings();

// Bring in function to generate prompt and images
const genImage = require("./src/genImg");

async function processBatch(index, total) {

    // Copy over prompt from settings
    let prompt = settings.settings.prompt;

    // Then pass it through dnamic prompts if any
    for(let i = 0; i < settings.settings.dynamicPrompts.length; i++) {
        const dynPromptName = settings.settings.dynamicPrompts[i];
        const dynPromptFunc = require(`./${settings.settings.dynamicPromptFiles}/${dynPromptName}`);
        prompt = dynPromptFunc(prompt, settings.settings, settings.imageSettings, settings.upscaleSettings, i);
    }

    // Remove annoying windows line-endings
    prompt = prompt.replaceAll('\r', '');

    // Send to console if not hidden
    if(!settings.settings.hidePrompt && !isServer) {
        console.log();
        console.log(`Prompt: ${prompt}`);
        console.log();
    }

    // Make into image if filled in and not blank
    if(settings.settings.generateImages && prompt != "")
        await genImage(prompt, index, total, settings.settings, settings.imageSettings, settings.upscaleSettings);
}

async function upscale() {
    if(!isServer)
        console.log(`Upscaling File ID: ${argv.upscaleFile.toString()}`);
    
    const upscaleExisting = require("./src/upscaleExisting");
    await upscaleExisting(argv.upscaleFile.toString(), settings.settings, settings.imageSettings, settings.upscaleSettings);

    if(!isServer)
        console.log("Done!")
    return;
}

// Runs the code, this is in it's own function because we use asyc/await
// to make sure the first batch is done before we send another
async function run() {
    // Generate a prompt for each prompt count
    for(let i = 0; i < settings.settings.promptCount; i++) {

        // Release all list files from memory and re-scan for list filenames to be reloaded upon request IF
        // * This is the first prompt OR
        // * It is configured to reload lists on prompt change AND lists are confoigured to be unique
        // If duplicate list items are allowed then theres no point in list reloading
        if((settings.settings.reloadListsOnPromptChange && settings.settings.listEntriesUsedOnce) || (i == 0))
            require("./helpers/listFiles").reloadListFiles(settings.settings);

        await processBatch(i, settings.settings.promptCount);
    }
}

module.exports = {
    argv,

    settings,
    reloadSettings,
    saveUserSettings,

    genImage,
    processBatch,
    upscale,
    run,
};
