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
const underwater = require("./underwater");
const water = require("./water");
const mystical = require("./mystical");
const nature = require("./nature");
const weather = require("./weather");

module.exports = function() {

	// Start with base prompt
	let prompt = `${underwater()}, landscape, ${water()}, ${mystical()}`;

	if(_.random(0.0, 1.0, true) < 0.25)
		prompt += ", dolphin"

	if(_.random(0.0, 1.0, true) < 0.20)
		prompt += ", whale"

	prompt += `, ${nature()}, ${weather()}`;

	return prompt;
}

module.exports.full = true;
