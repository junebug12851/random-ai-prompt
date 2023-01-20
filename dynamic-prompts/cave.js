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

module.exports = function() {

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
				prompt += `, sea cave, #underwater`;
				break;
			case 1:
				prompt += `, lava cave, #lava`;
				break;
			case 2:
				prompt += `, ice cave, #ice`;
				break;
			case 3:
				prompt += `, crystal cave, #crystal`;
				break;
		}
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cavern";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", glow";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", bioluminescent";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", structures"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, #color crystal`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, #color gemstone`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", stalagmite"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", stalactite"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", #settlement"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", tunnels"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", underground";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {color}";

	prompt += `, #nature, #wildlife, #water, #eerie, #mystical, #weather`;

	return prompt;
}

module.exports.full = true;
