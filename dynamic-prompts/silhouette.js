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

const _ = require("lodash");
const entityName = require("./entity-name");

// Multiple layers of silhouette <name>, with silhouette of <name>, 
// sharp edges, at sunset, with heavy fog in air, vector style, horizon silhouette Landscape wallpaper by Alena Aenami, firewatch game style, vector style background
module.exports = function(settings) {

	// This will not work well with added artists or fx
    settings.autoAddArtists = false;
    settings.autoAddFx = false;

	// Start with base prompt
	let prompt = `Multiple layers of silhouette ${entityName()}, with silhouette of ${entityName()}`;
	prompt += ", sharp edges, at";

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += " {time}";
	else
		prompt += " sunset";

	prompt += " with"

	if(_.random(0.0, 1.0, true) < 0.5)
		prompt += " {weather}";
	else
		prompt += " heavy fog in air";

	prompt += ", vector style, horizon silhouette Landscape wallpaper by Alena Aenami, firewatch game style, vector style background";

	return prompt;
}
