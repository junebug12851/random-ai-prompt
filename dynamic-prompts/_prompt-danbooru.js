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

const {keywordRepeater, artistRepeater} = require("../helpers/keywordRepeater");

// Generates a prompt containing this based on settings
// {d-general}... {d-character}... {d-meta}... {d-artist}... 
function expandRandom(settings) {
	const metaCount = _.random(0, 2, false);
	const characterCount = _.random(0, 2, false);

	let str = [];

	str.push(keywordRepeater("d-general", false, settings));

	if(_.random(0.0, 1.0, true) < 0.2)
		for(let i = 0; i < characterCount; i++) {
			str.push(`{d-character}`);
		}

	for(let i = 0; i < metaCount; i++) {
		str.push(`{d-meta}`);
	}

	const artists = artistRepeater("d-artist", false, settings);
	if(artists.length > 0)
		str.push(artists);

	return str.join(", ");
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {
	prompt = prompt.replaceAll(/\{prompt-danbooru\}/gm, function(match) {
		return expandRandom(settings);
	});

	// Return prompt
	return prompt;
}
