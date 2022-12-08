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

const fs = require('fs');
const _ = require("lodash");

// All-lists in memory
const lists = {};
const artists = {};

const keywordAlias = "keyword";
const artistAlias = "artist";
const randomAlias = "random";
const randomArtistAlias = "random-artist";

// Convert filename.txt -> filename
function removeExtension(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

// Get list of filenames.txt
function getListFiles(settings) {
    // Get all list files
    return fs.readdirSync(settings.listFiles);
}

// Reload file into the list in-memory
function reloadListFile(settings, name) {
    // Load list into memory as an array
    const list = fs.readFileSync(`${settings.listFiles}/${name}.txt`).toString().split("\n");

    // Save into memory under proper list category
    if (name == settings.artistFilename ||
        name.includes("artist"))
        artists[name] = list;
    else
        lists[name] = list;
}

function lazyReloadListFile(settings, name) {
    if (name == settings.artistFilename ||
        name.includes("artist"))
        artists[name] = [];
    else
        lists[name] = [];
}

// Reload all lists into memory
function reloadListFiles(settings) {

    // Get list files
    const files = getListFiles(settings);

    // Add-in real lists
    // Loop through all lists
    for (let i = 0; i < files.length; i++) {

        // Convert filename.txt to filename
        const key = removeExtension(files[i]);

        // Re-load into memory
        lazyReloadListFile(settings, key);
    }
}

function nameToData(settings, name, skipAliasCheck) {

    skipAliasCheck = (skipAliasCheck == true);

    if(!skipAliasCheck) {
        // use alias to refer to list if provided
        if (name == keywordAlias)
            name = settings.keywordsFilename;
        else if (name == artistAlias)
            name = settings.artistFilename;
        else if (name == randomAlias)
            name = _.sample(_.keys(lists));
        else if (name == randomArtistAlias)
            name = _.sample(_.keys(artists));
    }

    // Save pointer to list
    let list;
    let isArtistList = false;

    if (name == settings.artistFilename ||
        name.includes("artist")) {
        list = artists[name];
        isArtistList = true;
    }
    else
        list = lists[name];

    return {
        name,
        list,
        isArtistList,
    };
}

// Pulls a list entry from a named list
function pull(settings, name) {

    // Convert name to data
    let data = nameToData(settings, name);
    name = data.name;

    // Immidiately stop if artist are disabled when an artist is requested
    if (data.isArtistList && !settings.includeArtist)
        return "";

    // If list is empty, reload
    // We have to also re-update the list pointer
    if (data.list.length <= 0) {
        reloadListFile(settings, name);
        data = nameToData(settings, name, true);
    }

    // If still empty, return empty string
    if (data.list.length <= 0)
        return "";

    // Pull random index
    const index = _.random(0, data.list.length - 1);

    // Pull list entry
    const entry = data.list[index];

    // Remove it from the list
    if (settings.listEntriesUsedOnce)
        data.list.splice(index, 1);

    // If list is empty, reload
    if (data.list.length <= 0)
        reloadListFile(settings, name);

    // Return list item
    return entry;
}

module.exports = {

    keywordAlias,
    artistAlias,
    randomAlias,
    randomArtistAlias,

    reloadListFile,
    reloadListFiles,
    pull
};
