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

const {keywordRepeater, artistRepeater} = require("../helpers/keywordRepeater");

function multiColor() {
	return (_.random(0.0, 1.0, true) < 0.5) ? `multi color ` : ``;
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings, i) {

	const origPrompt = prompt;

	// Start with base prompt
	prompt = "castle, {view}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", moat"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", motte"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", courtyard"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", castle keep"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", castle wall"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", fortified tower"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", castle drawbridge"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", castle gatehouse"

	if(_.random(0.0, 1.0, true) < 0.2)
		prompt += ", {mythological-creature}"

	if(_.random(0.0, 1.0, true) < 0.3)
		prompt += ", {animal}"

	if(_.random(0.0, 1.0, true) < 0.3)
		prompt += ", {animal}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {city}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", lake"
	else if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", pond"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {building-style}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {time}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{flower}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{flower}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}vegetation`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{tree}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{tree}`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vines";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

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

	if(i != 0)
		prompt = `${origPrompt} AND ${prompt} :0.9`;

	return prompt;
}
