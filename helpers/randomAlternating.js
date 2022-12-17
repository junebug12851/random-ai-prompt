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

// Adds random emphasis/de-emphasis to keywords
module.exports = function randomAlternating(settings, keyword) {
	// Stop here if emphasis is disabled or if using an unsupported mode
	if(!settings.keywordAlternating || settings.mode == "Midjourney") {
		return {keyword, wasUsed: true};
	}

	// Backup keyword to be duplicated
	let name = keyword;

	// Already has 1 keyword
	let count = 1;

	// Randomly add extra alternating keywords
	do {
		keyword += `|${name}`
		count++;
	}while(_.random(0.0, 1.0, true) < settings.emphasisLevelChance && count < settings.keywordAlternatingMaxLevels);

	// Update modified keyword with emphais/de-emphasis
	// NovelAI doesn't want the square brackets around keyword
	if(settings.mode == "StableDiffusion")
		keyword = `[${keyword}]`;

	// Send prompt back
	return {keyword, wasUsed: true};
}
