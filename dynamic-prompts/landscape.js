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
	let prompt = `landscape`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", fog"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", hill"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", valley"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", cliff"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", forest"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", tree"

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += ", stone"

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += ", rock"

    if(_.random(0.0, 1.0, true) < 0.25)
        prompt += `, winter, snow landscape, #ice`;

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += `, #settlement`

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += `, #eerie`

    if(_.random(0.0, 1.0, true) < 0.25)
        prompt += `, #mystical`

    if(_.random(0.0, 1.0, true) < 0.3)
        prompt += `, #wildlife`

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, #water`

    prompt += `, #nature, #weather`;

    return prompt;
}

module.exports.full = true;
