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

const {artistRepeater} = require("../../helpers/keywordRepeater");

function maybeAddColor() {
	if(_.random(0.0, 1.0, true) < 0.5)
		return "{color} ";
	else
		return "";
}

function multiColor() {
	const addColor = _.random(0.0, 1.0, true) < 0.5;

	if(addColor && (_.random(0.0, 1.0, true) < 0.5))
		return "multi color ";
	else if(addColor)
		return maybeAddColor();

	return "";
}

module.exports = function(settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	let prompt = "city, streetview, {city}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {building-style}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {time}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", cityscape";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", downtown";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{flower}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{flower}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}vegetation`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, {tree}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, {tree}`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vines";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	prompt == ", reflective street, wide shot";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-movement}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {art-technique}"

	const imageEffects = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 5, false) : 0;

	for(let i = 0; i < imageEffects; i++)
		prompt += ", {image-effect}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", <rays>";

	// Add in artist
	const artists = artistRepeater("artist", true, settings);
	if(artists.length > 0)
		prompt += `, ${artists}`;

	return prompt;
}
