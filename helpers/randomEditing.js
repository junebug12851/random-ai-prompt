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

function editIn(settings, keyword) {
	return `[${keyword}:${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

function swapOut(settings, keyword) {
	return `[${keyword}:${keyword}:${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

function editOut(settings, keyword) {
	return `[${keyword}::${_.random(settings.keywordEditingMin, settings.keywordEditingMax)}]`;
}

// Adds random editing to keywords
module.exports = function randomEditing(settings, keyword) {
	// Stop here if editing is disabled
	if(!settings.keywordEditing) {
		return {keyword, wasUsed: false};
	}

	// Figure out what kind of editing
	switch(_.random(0, 2, false)) {
		case 0:
			keyword = editIn(settings, keyword);
			break;
		case 1:
			keyword = swapOut(settings, keyword);
			break;
		case 2:
			keyword = editOut(settings, keyword);
			break;
	}

	// Send prompt back
	return {keyword, wasUsed: true};
}
