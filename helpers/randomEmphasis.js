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
module.exports = function randomEmphasis(settings, keyword) {
	// Stop here if emphasis is disabled
	if(!settings.keywordEmphasis) {
		return {keyword, wasUsed: false};
	}

	// Roll to see if this keword gets less emphasis
	let lessEmphasis = (_.random(0.0, 1.0, true) < settings.deEmphasisChance);

	// Prepare for emphasis/de-emphasis leveling
	let prefix = "";
	let suffix = "";
	let count = 1;

	prefix += (lessEmphasis) ? "[" : "(";
	suffix += (lessEmphasis) ? "]" : ")";

	// Randomly add emphasis/de-emphasis levels based on chance for each level up to set max
	while(_.random(0.0, 1.0, true) < settings.emphasisLevelChance && count < settings.emphasisMaxLevels) {
		prefix += (lessEmphasis) ? "[" : "(";
		suffix += (lessEmphasis) ? "]" : ")";
		count++;
	}

	// Update modified keyword with emphais/de-emphasis
	keyword = `${prefix}${keyword}${suffix}`;

	// Send prompt back
	return {keyword, wasUsed: true};
}
