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

// Ensure we're within this directory
process.chdir(__dirname);
process.chdir("..");

// load imports
const fs = require('fs');
const _ = require("lodash");

// load settings
const settings = require("../settings");

// load tags file
const tags = require("./nai-tag-expirement.json");

// File results
let results = {};

// Loop through tag entries, process them, and send them to results
_.forOwn(tags, (val, key) => {
	// key = "Verb", val = Array of objects containing tag

	// Fix key to be good for a filename
	key = _.kebabCase(key);

	// Combine artist keys under a unified artist2 key
	if(key.startsWith("artist"))
		key = "artist2";

	// We already have a very sophisticated danbooru files,
	// No need to add more
	else if(key.startsWith("danbooru"))
		return;

	// Remove pluralization
	else if(key.endsWith("s"))
		key = key.substring(0, key.length - 1);

	// Don't like the word photo for image generations, especially if it's anime
	// or art
	else if(key == "photo-effect")
		key = "image-effect";

	// I feel this needs to be more specific, anime what?
	// titles of anime (anime-name) works best
	else if(key == "anime")
		key = "anime-name";

	// Make sure a slot is reserved in results
	if(results[key] === undefined)
		results[key] = [];

	// Now loop through array and add each tag
	for(let i = 0; i < val.length; i++) {
		let entry = val[i].tag;

		// Replace underscores and slashes with spaces, remove parenthesis
		entry = entry
			.replaceAll(/[\/\\_]/gm, " ")
			.replaceAll(/[\(\)]/gm, "")
			.replaceAll(/^(\W) (\W)$/gm, "$1_$2");

		// Add to results array
		results[key].push(entry);
	}
});

// Append my own wording

results["image-effect"] = [
	...results["image-effect"],
	"desaturated look",
	"vivid colors",
	"accented colors",
	"retro colors",
	"old look",
]

// Save results into files
_.forOwn(results, (val, key) => {

	// key = "<filename>", val = "file contents as array"

	// Write file
	fs.writeFileSync(`${settings.listFiles}/${key}.txt`, val.join("\n"));
});
