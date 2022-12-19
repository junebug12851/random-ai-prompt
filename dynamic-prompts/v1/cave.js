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
const {artistRepeater} = require("../../helpers/keywordRepeater");

function maybeAddColor() {

	let glow = "";

	if(_.random(0.0, 1.0, true) < 0.5)
		glow += "glowing ";

	if(_.random(0.0, 1.0, true) < 0.5)
		return `${glow}{color} `;
	else
		return "";
}

function waterCave() {
	let prompt = "sea cave, underwater, underwater photography";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", submerged"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", underwater paradise"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", aquatic life"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}reef`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}coral`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}starfish`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}fish`

	return prompt;
}

function lavaCave() {
	let prompt = "lava cave";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", magma"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", magma tube"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", lava pool"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", obsidian"

	return prompt;
}

function iceCave() {
	let prompt = "ice cave";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ice walls"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ice sheets"

	return prompt;
}

function crystalCave() {
	let prompt = "crystal cave";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", glowing"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}crystal walls`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}crystal floor`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}giant crystals`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ruby"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", diamond"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", emerald"

	return prompt;
}

module.exports = function(settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	let prompt = "cave, cave walls";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", subterranean";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", interior";

	// 50% chance to apply a cave type
	// 20% chance to overshoot on cave type and still not assign one
	if(_.random(0.0, 1.0, true) < 0.5) {
		switch(_.random(0, 4, false)) {
			case 0:
				prompt += `, ${waterCave()}`;
				break;
			case 1:
				prompt += `, ${lavaCave()}`;
				break;
			case 2:
				prompt += `, ${iceCave()}`;
				break;
			case 3:
				prompt += `, ${crystalCave()}`;
				break;
		}
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cavern";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", lush";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", glow";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", bioluminescent";

	if(_.random(0.0, 1.0, true) < 0.50)
		prompt += `, ${maybeAddColor()}plants`

	if(_.random(0.0, 1.0, true) < 0.50)
		prompt += `, ${maybeAddColor()}vegetation`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", structures"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}crystal`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor()}gemstone`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", stalagmite"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", stalactite"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", house"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", village"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", path"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", tunnels"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", oasis"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", life"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", animal"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", insect"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", bat"

	if(_.random(0.0, 1.0, true) < 0.2)
		prompt += ", {mythological-creature}"

	if(_.random(0.0, 1.0, true) < 0.3)
		prompt += ", {animal}"

	if(_.random(0.0, 1.0, true) < 0.3)
		prompt += ", {animal}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", water";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", river";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", lake";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", stream";

	const flowerCount = (_.random(0.0, 1.0, true) < 0.50) ? _.random(0, 3, false) : 0;
	const treeCount = (_.random(0.0, 1.0, true) < 0.50) ? _.random(0, 3, false) : 0;
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
		prompt += ", dark";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", eerie";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", scary";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", worn down";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", weathered";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", mysterious";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", underground";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {color}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", mesmorizing"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", magical"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", fantasy"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", epic"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", grand"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vast"

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

	return prompt;
}
