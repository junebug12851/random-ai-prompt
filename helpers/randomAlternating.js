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

let wasUsed = false;

// Adds random emphasis/de-emphasis to keywords
module.exports = function randomEmphasis(settings, keyword) {
	// Stop here if emphasis is disabled
	if(!settings.keywordAlternating) {
		return {keyword, wasUsed};
	}

	// Prepare for emphasis/de-emphasis leveling
	let count = 0;

	// Randomly add emphasis/de-emphasis levels based on chance for each level up to set max
	while(_.random(0.0, 1.0, true) < settings.emphasisLevelChance && count < settings.emphasisMaxLevels) {
		keyword += `|${keyword}`
		count++;
		wasUsed = true;
	}

	// Update modified keyword with emphais/de-emphasis
	if(wasUsed)
		keyword = `[${keyword}]`;

	// Send prompt back
	return {keyword, wasUsed};
}
