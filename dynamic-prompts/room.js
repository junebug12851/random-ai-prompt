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

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	prompt = "room, interrior, {room}";

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
			prompt += ", cobweb"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", spider web"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", grunge"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", rundown"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", broken"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", broken floor"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", torn wallpaper"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", mold"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", mildew"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", shattered glass"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", holes"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", floor hole"

		if(_.random(0.0, 1.0, true) < 0.5)
			prompt += ", ceiling hole"
	}

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", clutter"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", messy"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", furniture"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", items"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", accesories"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", window"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", furnished"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {building-style}"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += ", {time}"

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

	return prompt;
}
