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

function multiColor() {
	return (_.random(0.0, 1.0, true) < 0.5) ? `multi color ` : ``;
}

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	prompt = "city, streetview, {city}";

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
		prompt += `, ${multiColor()}{tree}`
	
	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += `, ${multiColor()}{tree}`

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", vines";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {weather}"

	prompt == ", reflective street, wide shot";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {render-color}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {render-color}";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", <rays>";

	prompt == ", lense flares";

	const artistCount = (settings.includeArtist) ? _.random(1, 3, false) : 0;	

	// Add in artist
	for(let i = 0; i < artistCount; i++) {
		prompt += ", {artist}";
	}

	return prompt;
}
