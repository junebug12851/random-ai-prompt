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

	let prompt = "";

	let flowerCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(1, 3, false) : 0;
	let treeCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(1, 3, false) : 0;

	// Add in flowers
	for(let i = 0; i < flowerCount; i++) {
		prompt += `, #color {flower}`;
	}

	// Add in trees
	for(let i = 0; i < treeCount; i++) {
		prompt += ", {tree}";
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vines";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, #color plants`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, #color vegetation`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", lush";

	if(_.random(0.0, 1.0, true) < 0.25)
		prompt += ", oasis"

	return prompt;
}
