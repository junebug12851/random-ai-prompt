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
const listFiles = require("./listFiles");

function processRepeat(count, keyword, alias) {

	if(count <= 0)
		return "";

	let str = [];

	for(let i = 0; i < count; i++) {
		if(alias == true)
			str.push(`{${listFiles[`${keyword}Alias`]}}`);
		else
			str.push(`{${keyword}}`);
	}

	return str.join(", ");
}

function keywordRepeater(keyword, alias, settings) {
	const keywordCount = _.random(settings.keywordCount, settings.keywordMaxCount, false);
	return processRepeat(keywordCount, keyword, alias);
}

function artistRepeater(artist, alias, settings) {
	const artistCount = (settings.includeArtist && (_.random(0.0, 1.0, true) < 0.5))
		? _.random(settings.minArtist, settings.maxArtist, false)
		: 0;

	return processRepeat(artistCount, artist, alias);	
}

module.exports = {
	keywordRepeater,
	artistRepeater,
}
