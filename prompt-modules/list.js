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

const fs = require('fs');
const _ = require("lodash");

// Bring in helper functions
const randomEmphasis = require("../helpers/randomEmphasis");
const randomEditing = require("../helpers/randomEditing");
const randomAlternating = require("../helpers/randomAlternating");
const listFiles = require("../helpers/listFiles");

// List of all prompt funcs
let promptFuncsSd = [
	randomEmphasis,
	randomEditing,
	randomAlternating,
];

let promptFuncsNai = [
	randomEmphasis,
	randomAlternating,
];

let promptFuncsMdj = [
	randomEmphasis,
	randomAlternating,
];

// List to give every prompt func a turn
let promptFuncsTmp = [];

function reloadPromptFunc(list) {
	promptFuncsTmp = _.clone(list);
}

// Pulls a random line from a list file
function sampleFile(name, settings, emphasis) {

	// If emphasis is not set, default to true, otherwise, convert to boolean
	emphasis = (emphasis === undefined)
		? true
		: (emphasis == true);

	if(!emphasis || _.random(0.0, 1.0, true) > settings.emphasisChance)
		return listFiles.pull(settings, name);

	// Set correct prompt func for target AI Generator
	let targList = promptFuncsSd;

	if(settings.mode == "NovelAI")
		targList = promptFuncsNai;
	else if(settings.mode == "Midjourney")
		targList = promptFuncsMdj;

	// Start list over if depleted
	if(promptFuncsTmp.length == 0)
		reloadPromptFunc(targList);

	// Shuffle funcs
	promptFuncsTmp = _.shuffle(promptFuncsTmp);

	// Put back in braces
	name = `{${name}}`;

	// Process and save
	name = promptFuncsTmp[0](settings, name).keyword;

	// Remove used entry from tmp list
	promptFuncsTmp.splice(0, 1);

	// Expand
	name = name.replaceAll(/\{(.*?)\}/gm, function(match, p1) {
		return listFiles.pull(settings, p1);
	});

	// Convert to NovelAI if it's enabled
	if(settings.mode == "NovelAI") {
		name = name.replaceAll("(", "{");
		name = name.replaceAll(")", "}");
	}

	return name;
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {
	// Process prompt, 2nd pass, expand list keywords into random items from list
	// also include random prompt if requested
	prompt = prompt.replaceAll(/\{(.*?)\}/gm, function(match, p1) {

		// If from the artist file, then pcik a random artist but do not emphasize
		// them
		if(p1 == settings.artistFilename || p1.includes("artist"))
			return sampleFile(p1, settings, false);

		// Otherwise, pull from the file and follow normal emphasis settings
		else
			return sampleFile(p1, settings, settings.keywordEmphasis);
	});

	// Return prompt
	return prompt;
}
