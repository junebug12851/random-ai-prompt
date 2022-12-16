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

// This was taken from publicprompts.art and modified to be more dynamic

const _ = require("lodash");

const {keywordRepeater, artistRepeater} = require("../helpers/keywordRepeater");

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `die-cut sticker, cute kawaii`; //`{d-character} sticker, white background, illustration minimalism, vector, pastel colors`;

	switch(_.random(0, 3, false)) {
		case 0:
			prompt += ` {animal}`;
		case 1:
			prompt += ` {d-character}`;
		case 2:
			prompt += ` {flower}`;
		case 3:
			prompt += ` {instrument}`;
		case 4:
			prompt += ` {mythological-creature}`;
		case 5:
			prompt += ` {tree}`;
	}

	const adjectiveCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 3, false) : 0;

	for(let i = 0; i < adjectiveCount; i++) {
		prompt += ", {adjective}";
	}

	const nounCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 3, false) : 0;

	for(let i = 0; i < nounCount; i++) {
		prompt += ", {noun}";
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {verb}"

	prompt += ` sticker, white background, illustration minimalism, vector, pastel colors`;

	// const artistCount = (settings.includeArtist) ? _.random(0, 3, false) : 0;	

	// // Add in artist
	// const artists = artistRepeater("artist", true, settings);
	// if(artists.length > 0)
	// 	prompt += `, ${artists}`;

	if(i != 0 && !settings.noAnd)
		prompt = `${origPrompt} AND ${prompt} :1.1`;
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;

	return prompt;
}
