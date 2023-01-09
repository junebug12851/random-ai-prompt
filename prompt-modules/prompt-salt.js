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

const _ = require("lodash");

function getRndSalt() {
	return `[${_.random(1000000000, 9999999999, false)}]`;
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	let foundSalt = false;
	let val = settings.promptSaltStart;

	prompt = prompt.replaceAll(/\{salt\}/gm, function(match) {
		foundSalt = true;
		imageSettings.usedSalt = (val >= 0) ? `[${val}]` : getRndSalt();
		return (val >= 0) ? `[${val}]` : getRndSalt();
	});

	prompt = prompt.replaceAll(/\[\d+\]/gm, function(match) {
		foundSalt = true;
		imageSettings.usedSalt = (val >= 0) ? `[${val}]` : getRndSalt();
		return (val >= 0) ? `[${val}]` : getRndSalt();
	});

	if(settings.promptSalt && !foundSalt) {

		imageSettings.usedSalt = (val >= 0) ? `[${val}]` : getRndSalt();

		if(val >= 0)
			prompt = `${prompt} [${val}]`;
		else
			prompt = `${prompt} ${getRndSalt()}`;
	}

	// Remove brackets around used salt
	if(imageSettings.usedSalt != undefined)
		imageSettings.usedSalt = imageSettings.usedSalt.replaceAll(/[\[\]]/gm, "");

	if(val >= 0) {
		settings.promptSaltStart++;
	}

	// Return prompt
	return prompt;
}
