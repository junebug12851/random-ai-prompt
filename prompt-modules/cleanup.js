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

/*
 * 1. Remove empty commas that don't look good
 * 2. Remove extra spaces that don't look good
*/

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Get rid of extra spaces
	prompt = prompt.replaceAll(/ +/gm, " ");

	// Get rid of unesesary commas
	prompt = prompt.split(",");
	const newPromt = [];

	for(let i = 0; i < prompt.length; i++) {
		const el = prompt[i].trim();
		if(el != "")
			newPromt.push(el);
	}

	prompt = newPromt.join(", ");

	// STOP SEEPING THROUGH
	// This is my 3rd check
	// We can't have commas or anything after AND only spaces
	prompt = prompt.replaceAll("AND,", "AND");

	// Return prompt
	return prompt;
}
