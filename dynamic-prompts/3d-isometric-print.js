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
const entityBasicKeywords = require("../helpers/entity-basic-keywords");

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

// Tiny cute isometric <name>, soft smooth lighting, with soft colors, 100mm lens, 3d blender render, trending on polycount, modular constructivism, blue background, physically based rendering, centered

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `Tiny cute isometric`;

	prompt += entityBasicKeywords();

	prompt += " soft smooth lighting, with soft colors, 100mm lens, 3d blender render, trending on polycount, modular constructivism, blue background, physically based rendering, centered";

	if(i != 0 && !settings.noAnd)
		prompt = `${origPrompt} AND ${prompt} :1.21`;
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;

	return prompt;
}
