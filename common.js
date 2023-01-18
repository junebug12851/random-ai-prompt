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

// Load imports
const fs = require('fs');
const path = require('path');
const _ = require("lodash");
const yargs = require('yargs/yargs')

// Process given arguments
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv
const saveResults = require("./helpers/saveResults");

// Bring in function to generate prompt and images
const genImage = require("./src/genImg");

const {
    settings,
    defSettings,
    reloadSettings,
    saveSettings,
    replaceSettings,
    userSettings
} = require("./src/loadSettings");

// Ensure lastCmd is removed
settings().imageSettings.lastCmd = undefined;

async function processBatch(index, total) {

    // Copy over prompt from settings
    let prompt = settings().settings.prompt;

    // If an animation prompt has already been set, use that instead
    if(settings().settings.animationPromptSet != undefined)
        prompt = settings().settings.animationPromptSet;

    // Then pass it through prompt modules if any
    for(let i = 0; i < settings().settings.promptModules.length; i++) {

        let promptModuleName = settings().settings.promptModules[i];

        // If animation prompt is set, then only change salt
        if(settings().settings.animationPromptSet != undefined)
            promptModuleName = `prompt-salt`;

        const promptModuleFunc = require(`./${settings().settings.promptModuleFiles}/${promptModuleName}`);
        prompt = promptModuleFunc(
            prompt,                         // Prompt
            settings().settings,            // Settings
            settings().imageSettings,       // Image Settings
            settings().upscaleSettings,     // Upscale Settings
        );

        // If animation prompt is set, then stop here
        if(settings().settings.animationPromptSet != undefined)
            break;
    }

    // Remove annoying windows line-endings
    prompt = prompt.replaceAll('\r', '');

    // If this is an animation, then update the prompt, this carries over the salt number
    if(settings().imageSettings.animationOf != undefined) {
        settings().settings.animationPromptSet = prompt;
    }

    // Send to console if not hidden
    if(!settings().settings.hidePrompt) {
        console.log();
        console.log(`Prompt: ${prompt}`);
        console.log();
    }

    // Save prompt
    if(settings().imageSettings.resultPrompts == undefined)
        settings().imageSettings.resultPrompts = [];

    settings().imageSettings.resultPrompts.push(prompt);
    saveResults(settings().imageSettings);

    // Make into image if filled in and not blank and targetting Stabloe Diffusion
    // Disallow if not targetting Stable Diffusion
    if(settings().settings.generateImages && prompt != "" && settings().settings.mode == "StableDiffusion")
        await genImage(prompt, index, total, settings().settings, settings().imageSettings, settings().upscaleSettings);

    // Bug Fix
    // If this is not added then for a batch of prompts, only the first prompt
    // has artists and fx added
    delete settings().imageSettings.autoIncludedFx;
    delete settings().imageSettings.autoIncludedArtists;
}

async function upscale(fileId) {
    console.log(`Upscaling File ID: ${fileId.toString()}`);
    
    const upscaleExisting = require("./src/upscaleExisting");
    await upscaleExisting(fileId.toString(), settings().settings, settings().imageSettings, settings().upscaleSettings);

    console.log("Done!")
    return;
}

// Runs the code, this is in it's own function because we use asyc/await
// to make sure the first batch is done before we send another
async function run() {

    // Clear results file
    settings().imageSettings.resultPrompts = [];
    settings().imageSettings.resultImages = [];
    saveResults(settings().imageSettings);

    // Generate a prompt for each prompt count
    for(let i = 0; i < settings().settings.promptCount; i++) {

        // Release all list files from memory and re-scan for list filenames to be reloaded upon request IF
        // * This is the first prompt OR
        // * It is configured to reload lists on prompt change AND lists are confoigured to be unique
        // If duplicate list items are allowed then theres no point in list reloading
        if((settings().settings.reloadListsOnPromptChange && settings().settings.listEntriesUsedOnce) || (i == 0))
            require("./helpers/listFiles").reloadListFiles(settings().settings);

        await processBatch(i, settings().settings.promptCount);
    }
}

let legacyTxtNotice = false;

function sendLegacyTxtNotice() {
    if(legacyTxtNotice)
        return;

    console.log("Converting legacy txt files to json in output folder...");
    legacyTxtNotice = true;
}

// Rename legacy txt files to json
const updateFiles = function(directoryName) {

    // get files in a directory
    const files = fs.readdirSync(directoryName);

    // Loop through them
    files.forEach(function(file) {

        // Get full path
        const fullPath = path.join(directoryName, file);

        // Is it a folder or file?
        const f = fs.statSync(fullPath);

        // Loop through folder if it is one
        if (f.isDirectory()) {
            updateFiles(fullPath);
        } else {

            // Make sure it's a txt file
            const ext = path.extname(fullPath).substring(1);
            if(ext != "txt")
                return;

            // Announce conversion begin
            sendLegacyTxtNotice();

            // Get path without extension
            const fullPathParsed = path.parse(fullPath);
            const fullBasePath = path.join(fullPathParsed.dir, fullPathParsed.name);

            // Copy it to a json file
            fs.cpSync(`${fullBasePath}.txt`, `${fullBasePath}.json`);

            // Remove txt file
            fs.rmSync(`${fullBasePath}.txt`);            
        }
    });
}

// Scan directory
if(!settings().imageSettings.convertedLegacyData)
    updateFiles(settings().imageSettings.saveTo);

// Save conversion data
settings().imageSettings.convertedLegacyData = true;
saveSettings();

module.exports = {
    argv,

    settings,
    defSettings,
    reloadSettings,
    saveSettings,
    replaceSettings,
    userSettings,

    genImage,
    processBatch,
    upscale,
    run,
};
