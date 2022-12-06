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

// load imports
const fs = require('fs');
const _ = require("lodash");

// load settings
const settings = require("./settings");

// Read csv file
const csv = fs.readFileSync(`./artists.csv`).toString().split("\n");

/////////////////////////
/// User Setting
////////////////////////

// Minimum amount of score before it's released into the artists files
const minScore = 0.4;

///////////////////////

// List of categories
// I have no idea what c and n are but im assuming they mean cartoon and nudity
// and i have no idea why they are seperate from the actual named categories
const anime = [];
const blackWhite = [];
const cartoon = [];
const digipaLowImpact = [];
const digipaMedImpact = [];
const digipaHighImpact = [];
const fareast = [];
const fineart = [];
const nudity = [];
const scribbles = [];
const special = [];
const ukioe = [];
const weird = [];
const unknown = [];

// loop through CSV
for(let i = 1; i < csv.length; i++) {

	// Get line and split into pieces
	// Remove windows line ending
	const csvLine = csv[i]
		.replaceAll("\r", "")
		.split(",");

	if(csvLine == "")
		continue;

	// Name the pieces
	const artist = csvLine[0];
	const score = parseFloat(csvLine[1]);
	const category = csvLine[2];

	if(score < minScore)
		continue;

	const keyword = artist;

	// Sort into correct file based on category
	if(category == "anime")
	    anime.push(keyword);
    else if(category == "black-white")
	    blackWhite.push(keyword);
    else if(category == "c")
	    cartoon.push(keyword);
    else if(category == "cartoon")
	    cartoon.push(keyword);
	else if(category == "digipa-low-impact")
	    digipaLowImpact.push(keyword);
    else if(category == "digipa-med-impact")
	    digipaMedImpact.push(keyword);
	else if(category == "digipa-high-impact")
	    digipaHighImpact.push(keyword);
    else if(category == "fareast")
	    fareast.push(keyword);
    else if(category == "fineart")
	    fineart.push(keyword);
    else if(category == "n")
	    nudity.push(keyword);
    else if(category == "nudity")
	    nudity.push(keyword);
    else if(category == "scribbles")
	    scribbles.push(keyword);
    else if(category == "special")
	    special.push(keyword);
    else if(category == "ukioe")
	    ukioe.push(keyword);
    else if(category == "weird")
	    weird.push(keyword);
	else
		unknown.push(keyword);
}

// Write out files
fs.writeFileSync(`${settings.listFiles}/artist-anime.txt`, anime.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-bw.txt`, blackWhite.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-cartoon.txt`, cartoon.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-dlow.txt`, digipaLowImpact.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-dmed.txt`, digipaMedImpact.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-dhigh.txt`, digipaHighImpact.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-digipa.txt`, [
	...digipaHighImpact,
	...digipaMedImpact,
	...digipaLowImpact,
].join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-fareast.txt`, fareast.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-fineart.txt`, fineart.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-nudity.txt`, nudity.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-scribbles.txt`, scribbles.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-special.txt`, special.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-ukioe.txt`, ukioe.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist-weird.txt`, weird.join("\n"));
fs.writeFileSync(`${settings.listFiles}/artist.txt`, [
	...anime,
	...blackWhite,
	...cartoon,
	...digipaHighImpact,
	...digipaMedImpact,
	...digipaLowImpact,
	...fareast,
	...fineart,
	...nudity,
	...scribbles,
	...special,
	...ukioe,
	...weird,
	...unknown,
].join("\n"));
