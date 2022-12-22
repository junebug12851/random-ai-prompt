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

// User submitted dynamic prompt by Merk

const _ = require("lodash");
const nature = require("../nature");
const water = require("../water");
const mystical = require("../mystical");
const weather = require("../weather");
const underwater = require("../underwater");
const lava = require("../lava");
const ice = require("../ice");
const city = require("../city");
const color = require("../color");

module.exports = function() {

	// Start with base prompt
	let prompt = "beach, palm trees";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", tropical";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", oceanside";

	// 50% chance to apply a cave type
	// 20% chance to overshoot on cave type and still not assign one
	if(_.random(0.0, 1.0, true) < 0.5) {
		switch(_.random(0, 4, false)) {
			case 0:
				prompt += `, beach oasis, ${city()}`;
				break;
			case 1:
				prompt += `, beach vegetation, ${nature()}`;
				break;
		}
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beach";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", seaside";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sand";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beachside"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} crystal`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} gemstone`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", oceanside"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sandy beach"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ocean view"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sea shells"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beach sand"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sand"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", palm trees";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", palm tree";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", small waves";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {color}";

	prompt += `, ${nature()}, ${water()}, ${mystical()}, ${weather()}, ${city()}`;

	return prompt;
}