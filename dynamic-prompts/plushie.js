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

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

// cute kawaii Squishy <name> plush toy, realistic texture, visible stitch line, soft smooth lighting, vibrant studio lighting, modular constructivism, physically based rendering, square image

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `cute kawaii Squishy`;

	let human = false;

	switch(_.random(0, 6, false)) {
		case 0:
			prompt += ` {animal}`;
			break;
		case 1:
			prompt += ` {d-character}`;
			human = true;
			break;
		case 2:
			prompt += ` {flower}`;
			break;
		case 3:
			prompt += ` {instrument}`;
			break;
		case 4:
			prompt += ` {mythological-creature}`;
			break;
		case 5:
			prompt += ` {tree}`;
			break;
		case 6:
			prompt += ` person`;
			human = true;
			break;
	}

	if(_.random(0.0, 1.0, true) < 0.5 && human)
		prompt += `, ${maybeAddColor()}{hair}`

	const clothingCount = (_.random(0.0, 1.0, true) < 0.5 && human) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < clothingCount; i++) {
		prompt += `, ${maybeAddColor()}{clothes}`;
	}

	prompt += ` plush toy, realistic texture, visible stitch line, soft smooth lighting, vibrant studio lighting, modular constructivism, physically based rendering, square image`;

	if(i != 0 && !settings.noAnd)
		prompt = `${origPrompt} AND ${prompt} :1.1`;
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;

	return prompt;
}
