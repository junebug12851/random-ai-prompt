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

// Orignally submitted by Merk, modified by me, junebug12851

const _ = require("lodash");
const nature = require("./nature");
const water = require("./water");
const weather = require("./weather");
const ice = require("./ice");
const city = require("./city");
const eerie = require("./eerie");
const house = require("./house");
const landscape = require("./landscape");
const ship = require("./ship");
const vehicle = require("./vehicle");
const wildlife = require("./wildlife");
const mystical = require("./mystical");

function winterBeach() {
	let prompt = "winter beach";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", snowy beach";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${ice()}`;

	return prompt;
}

module.exports = function() {

	// Start with base prompt
	let prompt = "beach, palm trees";

	// 50% chance for normal or winter beach
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${winterBeach()}`;
	else {

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", tropical";
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", oceanside";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", seaside";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sand";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beachside"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sandy beach"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ocean view"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", sea shells"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", beach sand"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", palm trees";
	else if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", palm tree";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${eerie()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {size} waves";

	if(_.random(0.0, 1.0, true) < 0.2)
		prompt += `, ${mystical()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${water()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${wildlife()}`;

	prompt += `, ${city()}`;

	switch(_.random(0, 3)) {
		case 0:
			prompt += `, ${nature()}, ${weather()}`;
			break;
		case 1:
			prompt += `, ${landscape()}`;
			break;
		case 2:
			prompt += `, ${ship()}`;
			break;
		case 3:
			prompt += `, ${vehicle()}`;
			break;
	}

	return prompt;
}

module.exports.full = true;
