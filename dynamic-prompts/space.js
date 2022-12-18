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
const combinePrompts = require("../helpers/combinePrompts");
const personSimple = require("./person-simple");

function maybeAddColor(fx) {
	let ret = "";

	if(_.random(0.0, 1.0, true) < 0.5 && fx)
		ret += "neon ";

	if(_.random(0.0, 1.0, true) < 0.5 && fx)
		ret += "glow ";

	if(_.random(0.0, 1.0, true) < 0.5)
		ret += "{color} ";
	
	return ret;
}

function maybeAddSize() {
	return (_.random(0.0, 1.0, true) < 0.5) ? "{size} " : "";
}

function addShip() {
	let prompt = "";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += maybeAddColor(_.random(0.0, 1.0, true) < 0.5);

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += maybeAddColor(_.random(0.0, 1.0, true) < 0.5);

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += "{size} ";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += "{construct-style} ";

	prompt += "spaceship ";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += "spacecraft ";

	return prompt;
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i, total, isLast) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = `space, outer space`;

	// Maybe insert an astronaut or random person
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", astronaut";
	else if(_.random(0.0, 1.0, true) < 0.5)
		prompt += personSimple("", settings, imageSettings, upscaleSettings, 0, 1, false);

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${addShip()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", satellite";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", nebula";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", galaxy";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", quasars";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", abell cluster";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", solar system";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", universe";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cosmos";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor(true)}${maybeAddSize()}sun`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor(true)}${maybeAddSize()}moon`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor(true)}${maybeAddSize()}planet`;
	else if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor(true)}${maybeAddSize()}{planet}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddColor(true)}${maybeAddSize()}star`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", shooting star";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", comet";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", meteor";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", meteor shower";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddSize()}astronomical object`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${maybeAddSize()}celestial object`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", neutron stars";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", exoplanet";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", supernova";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", gamma ray burst";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", pulsar";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", black hole";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", constellations";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", void";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", fantasy";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vast";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", mystical";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", magical";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", colorful";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beautiful";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", epic";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-movement}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-technique}"

	const imageEffects = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < imageEffects; i++)
		prompt += ", {image-effect}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", <rays>";

	const artistCount = (settings.includeArtist) ? _.random(0, 3, false) : 0;	

	// Add in artist
	const artists = artistRepeater("artist", true, settings);
	if(artists.length > 0)
		prompt += `, ${artists}`;

	prompt = combinePrompts(settings, prompt, origPrompt, 0.9, i, total);

	return prompt;
}
