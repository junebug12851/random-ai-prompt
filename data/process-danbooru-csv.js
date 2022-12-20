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

// Read csv file
const csv = fs.readFileSync(`./danbooru.csv`).toString().split("\n");

/////////////////////////
/// User Setting
////////////////////////

// Minimum amount of Danbooru Count before it's released into the danbooru files
const minCount = 500;

///////////////////////

// Arrays to hold file data
const generalKeywords = [];
const artistKeywords = [];
const copyrightKeywords = [];
const characterKeywords = [];
const metaKeywords = [];
const unknownKeywords = [];

// loop through CSV
for(let i = 0; i < csv.length; i++) {

	// Get line and split into pieces
	const csvLine = csv[i]
		.replaceAll("\r", "")
		.split(",");

	if(csvLine == "")
		continue;

	// Name the pieces
	const name = csvLine[0];
	const type = csvLine[1];
	const count = csvLine[2];

	// Minimum Quality
	if(count < minCount)
		continue;

	// Fix keyword
	// Replace underscores and slashes with spaces, remove parenthesis
	let keyword = name
		.replaceAll(/[\/\\_]/gm, " ")
		.replaceAll(/[\(\)]/gm, "")
		.replaceAll(/^(\W) (\W)$/gm, "$1_$2");

	// Sort into correct file based on keyword type
	if(type == 0)
		generalKeywords.push(keyword);
	else if(type == 1)
		artistKeywords.push(keyword);
	else if(type == 3)
		copyrightKeywords.push(keyword);
	else if(type == 4)
		characterKeywords.push(keyword);
	else if(type == 5)
		metaKeywords.push(keyword);
	else
		unknownKeywords.push(keyword);
}

// Write out files
// Copyright just seems like branded character so create a 2nd list containing both.
// Also create a master list containing everything
// And a list containing all but artists for use in settings
fs.writeFileSync(`${settings.listFiles}/d-general.txt`, generalKeywords.join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-artist.txt`, artistKeywords.join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-character-c.txt`, copyrightKeywords.join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-character-nc.txt`, characterKeywords.join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-character.txt`, [...characterKeywords, ...copyrightKeywords].join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-meta.txt`, metaKeywords.join("\n"));
fs.writeFileSync(`${settings.listFiles}/d-keyword.txt`, [
	...generalKeywords,
	...copyrightKeywords,
	...characterKeywords,
	...metaKeywords,
	...unknownKeywords,
].join("\n"));
fs.writeFileSync(`${settings.listFiles}/danbooru.txt`, [
	...generalKeywords,
	...artistKeywords,
	...copyrightKeywords,
	...characterKeywords,
	...metaKeywords,
	...unknownKeywords,
].join("\n"));
