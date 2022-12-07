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
const listFiles = require("../helpers/listFiles");

module.exports = function(prompt, settings, imageSettings, upscaleSettings) {

	// Start with base prompt
	prompt = "candle, candlelight, dark, interior";

	// Keywords
	const keywordCount = _.random(settings.keywordCount, settings.keywordMaxCount, false);
	const artistCount = (settings.includeArtist)
		? _.random(settings.minArtist, settings.maxArtist, false)
		: 0;

	let str = [];

	for(let i = 0; i < keywordCount; i++) {
		str.push(`{${listFiles.keywordAlias}}`);
	}

	for(let i = 0; i < artistCount; i++) {
		str.push(`{${listFiles.artistAlias}}`);
	}

	return `${prompt}, ${str.join(", ")}`;
}
