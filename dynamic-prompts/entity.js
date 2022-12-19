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

const color = require("./color");

const anyEntity = [0, 1, 2, 3, 4, 5, 6];
const humanEntity = [1, 6];
const animalEntity = [0, 4];
const livingEntity = [0, 1, 4, 6];

module.exports = function(settings, imageSettings, upscaleSettings, specificEntity, nameOnly) {

	let prompt = "";

	if(nameOnly == undefined)
		nameOnly = false;

	let emotion = false;
	let human = false;
	let index = anyEntity[_.random(0, anyEntity.length - 1, false)];

	if(specificEntity == "human")
		index = humanEntity[_.random(0, humanEntity.length - 1, false)];
	else if(specificEntity == "animal")
		index = animalEntity[_.random(0, animalEntity.length - 1, false)];
	else if(specificEntity == "living")
		index = livingEntity[_.random(0, livingEntity.length - 1, false)];

	switch(index) {
		case 0:
			prompt += `{animal}`;
			emotion = true;
			break;
		case 1:
			prompt += `{d-character}`;
			emotion = true;
			human = true;
			break;
		case 2:
			prompt += `${color()} {flower}`;
			break;
		case 3:
			prompt += `{instrument}`;
			break;
		case 4:
			prompt += `{mythological-creature}`;
			emotion = true;
			break;
		case 5:
			prompt += `{tree}`;
			break;
		case 6:
			prompt += `person`;
			emotion = true;
			human = true;
			break;
	}

	if(_.random(0.0, 1.0, true) < 0.5 && emotion && !nameOnly)
		prompt += ", {emotion}"

	if(_.random(0.0, 1.0, true) < 0.5 && human && !nameOnly)
		prompt += `, ${color()} {hair}`

	const clothingCount = (_.random(0.0, 1.0, true) < 0.5 && human && !nameOnly) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < clothingCount; i++) {
		prompt += `, ${color()} {clothes}`;
	}

	return prompt;
}
