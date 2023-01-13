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
const nature = require("./nature");
const weather = require("./weather");
const eerie = require("./eerie");
const ice = require("./ice");
const mystical = require("./mystical");
const wildlife = require("./wildlife");
const roomState = require("./room-state");

module.exports = function() {

	let prompt = "store, storefront, {store-type}, streetview";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", intricate";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", detailed";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cozy";

	prompt += `, ${nature()}`;

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += `, ${eerie()}`;

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += `, ${ice()}`;

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += `, ${mystical()}`;

	if(_.random(0.0, 1.0, true) < 0.35)
		prompt += `, ${wildlife()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${roomState()}`;

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", city";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {city}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {building-style}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", downtown";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", reflective street";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", wide shot";

	prompt += `, ${weather()}`;

	return prompt;
}

module.exports.full = true;
