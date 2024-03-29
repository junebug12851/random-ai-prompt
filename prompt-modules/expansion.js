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

const loraFind = "<lora:";
const loraReplacement = "%%lora:";

function expandExpansion(name, settings) {
	// Read expansion file contents
	return fs.readFileSync(`${settings.expansionFiles}/${name}.txt`).toString();
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Max iterations in case of infinite loops
	let maxCount = 10;

	// Lora compatible
	// Lora's syntax is similar to the expansion syntax (<lora:name:weight>) so
	// we have to issue a compatibility fix (<lora:name:weight> => %%lora:name:weight>)
	// The only easiest way I see to make this work is to make it something else
	// and then back to bypass the checks
	// otherwise this gets very complicated
	prompt = prompt.replaceAll(loraFind, loraReplacement);

	// Keep expanding expansions up to max levels
	for(let i = 0; i < maxCount && /<(.*?)>/gm.test(prompt); i++) {

		// After every pass, ensure Lora prefixed is renamed
		// This allows Loras to be in expansions, even deeply nested
		prompt = prompt.replaceAll(loraFind, loraReplacement);

		prompt = prompt.replaceAll(/<(.*?)>/gm, function(match, p1) {
			return expandExpansion(p1, settings);
		});
	}

	// Make it all back
	prompt = prompt.replaceAll(loraReplacement, loraFind);

	// Return prompt
	return prompt;
}
