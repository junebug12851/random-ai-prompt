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

// Some keywords are better converted to danbooru if danbooru is in effect
function danbooruReplacer(prompt, settings) {
	if(settings.keywordsFilename == false ||
		(!settings.keywordsFilename.startsWith("d-") &&
				settings.keywordsFilename != "danbooru"))
		return prompt;

	// Person (Case-Insensitive) followed by word-boundry, replace with
	// {d-person} and carry over word boundry
	prompt = prompt.replaceAll(/Person(\W)/gmi, "{d-person}$1");

	return prompt;
}

function convertToPath(name) {
	if(!name.startsWith("user-"))
		return name;

	name = name.replace("user-", "");
	return `user-submitted/${name}`;
}

function expandDynamicPromptV2(name, settings, imageSettings, upscaleSettings) {

	// Remove -v2
	name = name.replace("-v2", "");

	// Read expansion file contents
	return danbooruReplacer(
		require(`../${settings.dynamicPromptFiles}/${convertToPath(name)}`)(settings, imageSettings, upscaleSettings),
		settings);
}

function expandDynamicPromptV1(name, settings, imageSettings, upscaleSettings) {

	// V1 already includes these
	settings.autoAddFx = false;
	settings.autoAddArtists = false;

	// Remove -v1
	name = name.replace("-v1", "");

	// Read expansion file contents
	return danbooruReplacer(
		require(`../${settings.dynamicPromptFiles}/v1/${convertToPath(name)}`)(settings, imageSettings, upscaleSettings),
		settings);
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Check for these before expansion
	const includedArtists = prompt.includes("#artists") || imageSettings.autoIncludedArtists;
	const includedFx = prompt.includes("#fx") || imageSettings.autoIncludedFx;

	// Expand all dynamic functions
	prompt = prompt.replaceAll(/#([\w\-_]+)/gm, function(match, p1) {

		if(p1.endsWith("-v1"))
			return expandDynamicPromptV1(p1, settings, imageSettings, upscaleSettings);
		else
			return expandDynamicPromptV2(p1, settings, imageSettings, upscaleSettings);
	});

	// Auto-append fx and artists if cofnigured to do so
	// We do this afterwards because some modules may change the settings
	// so we have to rprocess the modules first

	// Auto-add fx first if requested to do so
	if(settings.autoAddFx && !includedFx) {
		prompt += `, ${expandDynamicPromptV2("fx", settings, imageSettings, upscaleSettings)}`;
		imageSettings.autoIncludedFx = true;
	}

	// Auto-add artists second if requested to do so
	if(settings.autoAddArtists && !includedArtists) {
		prompt += `, ${expandDynamicPromptV2("artists", settings, imageSettings, upscaleSettings)}`;
		imageSettings.autoIncludedArtists = true;
	}

	// Save the original post prompt
	// The prompt after dynamic prompts but before the lists have been expanded on
	imageSettings.origPostPrompt = prompt;

	// Return prompt
	return prompt;
}
