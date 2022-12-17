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
const combinePrompts = require("../helpers/combinePrompts");

// gold <name> pendant, intricate 2d vector geometric, cutout shape pendant, blueprint frame lines sharp edges, svg vector style, product studio shoot
module.exports = function(prompt, settings, imageSettings, upscaleSettings, i, total, isLast) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `gold`;

	switch(_.random(0, 6, false)) {
		case 0:
			prompt += ` {animal}`;
			break;
		case 1:
			prompt += ` {d-character}`;
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
			break;
	}

	prompt += ` pendant, intricate 2d vector geometric, cutout shape pendant, blueprint frame lines sharp edges, svg vector style, product studio shoot`;
	prompt = combinePrompts(settings, prompt, origPrompt, 1.1, i, total);

	return prompt;
}
