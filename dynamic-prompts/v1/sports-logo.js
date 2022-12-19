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

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

// 2d ferocious <name>, vector illustration, angry eyes, football team emblem logo, 2d flat, centered
module.exports = function(settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	let prompt = `2d ferocious`;

	let human = false;

	switch(_.random(0, 3, false)) {
		case 0:
			prompt += ` {animal}`;
			break;
		case 1:
			prompt += ` {d-character}`;
			human = true;
			break;
		case 2:
			prompt += ` {mythological-creature}`;
			break;
		case 3:
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

	prompt += ` vector illustration, angry eyes, football team emblem logo, 2d flat, centered`;

	return prompt;
}
