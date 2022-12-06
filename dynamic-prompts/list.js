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
const listFiles = require("../helpers/listFiles");

// Pulls a random line from a list file
function sampleFile(name, settings, emphasis) {

	// If emphasis is not set, default to true, otherwise, convert to boolean
	emphasis = (emphasis === undefined)
		? true
		: (emphasis == true);

	// Return random keyword with optional random emphasis added
	if(emphasis)
		return randomEmphasis(settings, [listFiles.pull(settings, name)]);
	else
		return listFiles.pull(settings, name);
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {
	// Process prompt, 2nd pass, expand list keywords into random items from list
	// also include random prompt if requested
	prompt = prompt.replaceAll(/\{(.*?)\}/gm, function(match, p1) {
		// If from the artist file, then pcik a random artist but do not emphasize
		// them
		if(p1 == settings.artistFilename)
			return sampleFile(p1, settings, false);

		// Otherwise, pull from the file and follow normal emphasis settings
		else
			return sampleFile(p1, settings, settings.keywordEmphasis);
	});

	// Return prompt
	return prompt;
}
