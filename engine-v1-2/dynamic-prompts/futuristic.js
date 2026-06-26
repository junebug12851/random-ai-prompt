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

// Keeps track of what dynamic prompts have been used
let data = {};

module.exports = function() {

	// Ensure their reset
	data = {};

	// Start with base prompt
	let prompt = "futuristic";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", metal";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", bolt";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", high-tech";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cyberpunk";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", ancient";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", (#glow)"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", (#neon)"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", night"

	if(_.random(0.0, 1.0, true) < 0.35)
        prompt += ", fog"

    if(_.random(0.0, 1.0, true) < 0.35)
		prompt += ", mecha";

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += `, #crystal`;

	// Chance to include a person or animal
	if(_.random(0.0, 1.0, true) < 0.35) {
		prompt += ", #portrait-person";

		if(_.random(0.0, 1.0, true) < 0.50)
			prompt += ", solo";

		data.weather = true;
		data.animal = true;
	}
	else if(_.random(0.0, 1.0, true) < 0.35) {
		prompt += ", #portrait-animal";
		data.weather = true;
	}

	// Don't include both ruins and city
	if(_.random(0.0, 1.0, true) < 0.15) {
		prompt += `, #ruins`;
		data.eerie = true;
		data.mystical = true;
		data.weather = true;
	}
	else if(_.random(0.0, 1.0, true) < 0.35) {
		prompt += `, #city`;
		data.weather = true;
	}

	if((_.random(0.0, 1.0, true) < 0.20) && !data.animal)
		prompt += `, #animal`;

	if((_.random(0.0, 1.0, true) < 0.35) && !data.eerie)
		prompt += `, #eerie`;

	if((_.random(0.0, 1.0, true) < 0.35) && !data.mystical)
		prompt += `, #mystical`;
		
	if((_.random(0.0, 1.0, true) < 0.35) && !data.weather)
		prompt += `, #weather`;

	if(_.random(0.0, 1.0, true) < 0.20)
		prompt += ", artifact";

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += ", dramatic lighting";

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += ", intense";

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += ", <dap>";

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += ", <legacy-detail>";

	return prompt;
}

module.exports.full = true;
