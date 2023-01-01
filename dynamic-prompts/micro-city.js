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

// This was taken from publicprompts.art and modified to be more dynamic

const nature = require("./nature");
const weather = require("./weather");

// 100mm photo of isometric floating island in the sky, surreal <name>, intricate, high detail, behance, microworlds smooth, macro sharp focus, centered
module.exports = function(settings) {

    // This will not work well with added artists or fx
    settings.autoAddArtists = false;
    settings.autoAddFx = false;

	// Start with base prompt
	let prompt = "100mm photo of isometric floating island in the sky, surreal, city";
	prompt += `, ${nature()}, ${weather()}`;
	prompt += ", intricate, high detail, behance, microworlds smooth, macro sharp focus, centered";

	return prompt;
}

module.exports.full = true;
