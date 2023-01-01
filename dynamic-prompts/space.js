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
const portraitPerson = require("./portrait-person");
const color = require("./color");
const glow = require("./glow");
const neon = require("./neon");
const ship = require("./spaceship");
const mystical = require("./mystical");

function maybeAddSize() {
	return (_.random(0.0, 1.0, true) < 0.5) ? "{size} " : "";
}

module.exports = function() {

	// Start with base prompt
	let prompt = `space, outer space`;

	// Maybe insert an astronaut or random person

	if(_.random(0.0, 1.0, true) < 0.5) {
		switch(_.random(0, 1, false)) {
			case 0:
				prompt += ", astronaut";
				break;
			case 1:
				prompt += `, ${portraitPerson()}`;
				break;
		}
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${ship()}`;

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
		prompt += `, ${color()} ${maybeAddSize()}sun`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} ${maybeAddSize()}moon`;

	if(_.random(0.0, 1.0, true) < 0.5) {
		switch(_.random(0, 1, false)) {
			case 0:
				prompt += `, ${color()} ${maybeAddSize()}planet`;
				break;
			case 1:
				prompt += `, ${color()} ${maybeAddSize()}{planet}`;
				break;
		}
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} ${maybeAddSize()}star`;

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
		prompt += ", colorful";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beautiful";

	prompt += `, ${mystical()}`;

	return prompt;
}

module.exports.full = true;
