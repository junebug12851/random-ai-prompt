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
	let prompt = "";

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
			prompt += ", broken"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", holes"
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", messy"

	return prompt;
}
