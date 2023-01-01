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
const eerie = require("./eerie");
const ice = require("./ice");
const lava = require("./lava");
const underwater = require("./underwater");
const mystical = require("./mystical");
const nature = require("./nature");
const weather = require("./weather");
const wildlife = require("./wildlife");
const color = require("./color");

function addWeatherFx(prompt) {
	switch(_.random(0, 3, false)) {
		case 0:
			prompt += `, ${ice()}`;
			break;
		case 1:
			prompt += `, ${lava()}`;
			break;
		case 2:
			prompt += `, ${underwater()}`;
			break;
	}

	return prompt;
}

module.exports = function() {

	// Start with base prompt
	let prompt = "ship, {ship-type}, ";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt = addWeatherFx(prompt);

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} `;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${color()} `;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {size} ";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {mood} atmosphere"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", detailed"

	if(_.random(0.0, 1.0, true) < 0.5) {

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", reflective surface"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", polished"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", shiny"
	}
	else {
		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", dirty"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", grunge"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", rundown"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", broken"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", torn"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", holes"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", graffiti"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", abandoned"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", ghost ship"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", cracked"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", rusted"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", damaged"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", destroyed"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", sunk"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", wrecked"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += `, ${eerie()}`;

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += `, ${nature()}`;

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += `, ${wildlife()}`;
	}

	if(_.random(0.0, 1.0, true) < 0.25)
		prompt += `, ${mystical()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {construct-style}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {building-style}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${weather()}`;

	return prompt;
}

module.exports.full = true;
