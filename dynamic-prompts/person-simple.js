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

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `portrait, person`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", full body"
	else if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", head and chest, upperbody"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", up-close"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}{hair}`

	const clothingCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < clothingCount; i++) {
		prompt += `, ${maybeAddColor()}{clothes}`;
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

	if(_.random(0.0, 1.0, true) < 0.2)
		prompt += ", {instrument}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", dynamic-pose"

	if(i != 0 && !settings.noAnd)
		prompt = `${origPrompt} AND ${prompt} :1.21`;
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;

	return prompt;
}
