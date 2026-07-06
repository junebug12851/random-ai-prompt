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

/**
 * @file
 * @brief Build script: turn artists.csv (AUTOMATIC1111 artist-score CSV) into the artist-*.txt lists, filtered by score and bucketed by category. Run manually. See notes/reference/blocks.md.
 */

// load imports
import fs from "node:fs";

// load settings
import settings from "../settings.js";

// content-safety filter (see src/contentSafety.js)
import { classifyRemoval } from "../contentSafety.js";

// Ensure we're within this directory
process.chdir(import.meta.dirname);
process.chdir("..");

// Read csv file
const csv = fs.readFileSync(`./data/sources/artists.csv`).toString().split("\n");

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
for (let i = 1; i < csv.length; i++) {
  // Get line and split into pieces
  // Remove windows line ending
  const csvLine = csv[i].replaceAll("\r", "").split(",");

  if (csvLine == "") continue;

  // Name the pieces
  const artist = csvLine[0];
  const score = parseFloat(csvLine[1]);
  const category = csvLine[2];

  if (score < minScore) continue;

  const keyword = artist;

  // Drop disallowed content before it ever reaches a list
  if (classifyRemoval(keyword, { listType: "proper" })) continue;

  // Sort into correct file based on category
  if (category == "anime") anime.push(keyword);
  else if (category == "black-white") blackWhite.push(keyword);
  else if (category == "c") cartoon.push(keyword);
  else if (category == "cartoon") cartoon.push(keyword);
  else if (category == "digipa-low-impact") digipaLowImpact.push(keyword);
  else if (category == "digipa-med-impact") digipaMedImpact.push(keyword);
  else if (category == "digipa-high-impact") digipaHighImpact.push(keyword);
  else if (category == "fareast") fareast.push(keyword);
  else if (category == "fineart") fineart.push(keyword);
  else if (category == "n") nudity.push(keyword);
  else if (category == "nudity") nudity.push(keyword);
  else if (category == "scribbles") scribbles.push(keyword);
  else if (category == "special") special.push(keyword);
  else if (category == "ukioe") ukioe.push(keyword);
  else if (category == "weird") weird.push(keyword);
  else unknown.push(keyword);
}

// Write out files into the artist/ folder (prefix dropped).
const aDir = `${settings.listFiles}/artist`;
fs.mkdirSync(aDir, { recursive: true });
fs.writeFileSync(`${aDir}/anime.txt`, anime.join("\n"));
fs.writeFileSync(`${aDir}/bw.txt`, blackWhite.join("\n"));
fs.writeFileSync(`${aDir}/cartoon.txt`, cartoon.join("\n"));
fs.writeFileSync(`${aDir}/dlow.txt`, digipaLowImpact.join("\n"));
fs.writeFileSync(`${aDir}/dmed.txt`, digipaMedImpact.join("\n"));
fs.writeFileSync(`${aDir}/dhigh.txt`, digipaHighImpact.join("\n"));
fs.writeFileSync(`${aDir}/fareast.txt`, fareast.join("\n"));
fs.writeFileSync(`${aDir}/fineart.txt`, fineart.join("\n"));
fs.writeFileSync(`${aDir}/nudity-nsfw.txt`, nudity.join("\n"));
fs.writeFileSync(`${aDir}/scribbles.txt`, scribbles.join("\n"));
fs.writeFileSync(`${aDir}/special.txt`, special.join("\n"));
fs.writeFileSync(`${aDir}/ukioe.txt`, ukioe.join("\n"));
fs.writeFileSync(`${aDir}/weird.txt`, weird.join("\n"));

// The composite "artist-digipa" and "artist" lists that used to be written here
// are now VIRTUAL lists assembled on demand from the atomic artist/* lists —
// see src/listManifest.js. "unknown"-category artists are appended to
// artist/special so they are still drawn.
if (unknown.length) {
  fs.appendFileSync(`${aDir}/special.txt`, "\n" + unknown.join("\n"));
}
