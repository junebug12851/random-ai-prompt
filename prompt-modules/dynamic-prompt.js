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

function expandDynamicPrompt(name, settings, imageSettings, upscaleSettings) {
	// Read expansion file contents
	return require(`../${settings.dynamicPromptFiles}/${name}`)(settings, imageSettings, upscaleSettings);
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Expand all dynamic functions
	prompt = prompt.replaceAll(/#([\w\-_]+)\W/gm, function(match, p1) {
		return expandDynamicPrompt(p1, settings, imageSettings, upscaleSettings);
	});

	// Return prompt
	return prompt;
}
