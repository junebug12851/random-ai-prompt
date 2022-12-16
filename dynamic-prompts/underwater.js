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
	prompt = "underwater, underwater photography, landscape";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ocean"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", submerged"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", underwater paradise"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", mesmorizing"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", aquatic life"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}bioluminescent`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}reef`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", magical"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}coral`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}starfish`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}fish`

	if(_.random(0.0, 1.0, true) < 0.25)
		prompt += ", dolphin"

	if(_.random(0.0, 1.0, true) < 0.20)
		prompt += ", whale"

	if(_.random(0.0, 1.0, true) < 0.50)
		prompt += `, ${maybeAddColor()}plants`

	if(_.random(0.0, 1.0, true) < 0.50)
		prompt += `, ${maybeAddColor()}vegetation`

	const flowerCount = (_.random(0.0, 1.0, true) < 0.50) ? _.random(1, 3, false) : 0;
	const treeCount = (_.random(0.0, 1.0, true) < 0.50) ? _.random(1, 3, false) : 0;
	const artistCount = (settings.includeArtist) ? _.random(0, 3, false) : 0;

	// Add in flowers
	for(let i = 0; i < flowerCount; i++) {
		prompt += `, ${maybeAddColor()}{flower}`;
	}

	// Add in trees
	for(let i = 0; i < treeCount; i++) {
		prompt += ", {tree}";
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {time}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-movement}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-technique}"

	const imageEffects = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < imageEffects; i++)
		prompt += ", {image-effect}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", <rays>";

	// Add in artist
	const artists = artistRepeater("artist", true, settings);
	if(artists.length > 0)
		prompt += `, ${artists}`;

	if(i != 0 && !settings.noAnd)
		prompt = `${origPrompt} AND ${prompt} :0.9`;
	else if(i != 0 && settings.noAnd)
		prompt = `${origPrompt}, ${prompt}`;

	return prompt;
}
