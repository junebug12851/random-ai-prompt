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
const _ = require("lodash");
const yargs = require('yargs/yargs')

// Process given arguments
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

// Ensure user-settings is created
require("./src/createMissingUserSettings")();

// Load settings
const { settings } = require("./user-settings");
const { imageSettings } = require("./user-settings");
const { upscaleSettings } = require("./user-settings");

// If requested to make image variations of a file, this will load in the settings
// needed to make it happen. It is done before command line prompts to alow custom override
if(argv.fileVariations !== undefined)
	require("./src/loadVariationData")(argv.fileVariations, settings, imageSettings, upscaleSettings);

// Use command line to override settings if any arguments are specified
require("./src/applyArgs")(argv, settings, imageSettings, upscaleSettings);

// Bring in function to generate prompt and images
const genImage = require("./src/genImg");

async function processBatch(index, total) {

	// Copy over prompt from settings
	let prompt = settings.prompt;

	// Then pass it through dnamic prompts if any
	for(let i = 0; i < settings.dynamicPrompts.length; i++) {
		const dynPromptName = settings.dynamicPrompts[i];
		const dynPromptFunc = require(`./${settings.dynamicPromptFiles}/${dynPromptName}`);
		prompt = dynPromptFunc(prompt, settings, imageSettings, upscaleSettings, i);
	}

	// Remove annoying windows line-endings
	prompt = prompt.replaceAll('\r', '');

	// Send to console if not hidden
	if(!settings.hidePrompt) {
		console.log();
		console.log(`Prompt: ${prompt}`);
		console.log();
	}

	// Make into image if filled in and not blank
	if(settings.generateImages && prompt != "")
		await genImage(prompt, index, total, settings, imageSettings, upscaleSettings);
}

// Runs the code, this is in it's own function because we use asyc/await
// to make sure the first batch is done before we send another
async function run() {

	// If requested to upscale a file, do only that and stop
	if(argv.upscaleFile !== undefined) {
		console.log(`Upscaling File ID: ${argv.upscaleFile.toString()}`);
		const upscaleExisting = require("./src/upscaleExisting");
		await upscaleExisting(argv.upscaleFile.toString(), settings, imageSettings, upscaleSettings);
		console.log("Done!")
		return;
	}

	// Generate a prompt for each prompt count
	for(let i = 0; i < settings.promptCount; i++) {

		// Release all list files from memory and re-scan for list filenames to be reloaded upon request IF
		// * This is the first prompt OR
		// * It is configured to reload lists on prompt change AND lists are confoigured to be unique
		// If duplicate list items are allowed then theres no point in list reloading
		if((settings.reloadListsOnPromptChange && settings.listEntriesUsedOnce) || (i == 0))
			require("./helpers/listFiles").reloadListFiles(settings);

		await processBatch(i, settings.promptCount);
	}
}

run();
