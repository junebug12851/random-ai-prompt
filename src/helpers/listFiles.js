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
 * @brief In-memory list store: pull with once-only depletion and keyword/artist alias resolution. Default-export object, indexed dynamically (do not flip to named).
 */

import fs from "node:fs";
import _ from "lodash";
import { keywordAlias, artistAlias } from "./aliases.js";

// All-lists in memory
const lists = {};
const artists = {};

/**
 * Strip a file extension (`name.txt` → `name`).
 * @param {string} filename The filename.
 * @returns {string} The name without its extension.
 */
// Convert filename.txt -> filename
function removeExtension(filename) {
  return filename.substring(0, filename.lastIndexOf(".")) || filename;
}

/**
 * @param {object} settings The merged generation settings (`listFiles` dir).
 * @returns {string[]} The list filenames in the list directory.
 */
// Get list of filenames.txt
function getListFiles(settings) {
  // Get all list files
  return fs.readdirSync(settings.listFiles);
}

/**
 * Load a list file fully into memory (under the artist or keyword bucket).
 * @param {object} settings The merged generation settings.
 * @param {string} name The list name.
 * @returns {void}
 */
// Reload file into the list in-memory
function reloadListFile(settings, name) {
  // Load list into memory as an array
  const list = fs.readFileSync(`${settings.listFiles}/${name}.txt`).toString().split("\n");

  // Save into memory under proper list category
  if (name == settings.artistFilename || name.includes("artist")) artists[name] = list;
  else lists[name] = list;
}

/**
 * Mark a list slot empty so it is lazily re-read from disk on next pull.
 * @param {object} settings The merged generation settings.
 * @param {string} name The list name.
 * @returns {void}
 */
function lazyReloadListFile(settings, name) {
  if (name == settings.artistFilename || name.includes("artist")) artists[name] = [];
  else lists[name] = [];
}

/**
 * Lazily clear every list (forces a fresh draw set on the next prompt).
 * @param {object} settings The merged generation settings.
 * @returns {void}
 */
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

/**
 * Resolve a list name (handling the `keyword`/`artist` aliases) to its in-memory array.
 * @param {object} settings The merged generation settings.
 * @param {string} name The requested list name or alias.
 * @param {boolean} [skipAliasCheck] Skip alias resolution (used after a reload).
 * @returns {{name: string, list: string[], isArtistList: boolean}} The resolved list handle.
 */
function nameToData(settings, name, skipAliasCheck) {
  skipAliasCheck = skipAliasCheck == true;

  if (!skipAliasCheck) {
    // use alias to refer to list if provided
    if (name == keywordAlias && settings.keywordsFilename.toString() != "false")
      name = settings.keywordsFilename;
    else if (name == artistAlias && settings.artistFilename.toString() != "false")
      name = settings.artistFilename;
    else if (name == keywordAlias && settings.keywordsFilename.toString() == "false")
      name = _.sample(_.keys(lists));
    else if (name == artistAlias && settings.artistFilename.toString() == "false")
      name = _.sample(_.keys(artists));
  }

  // Save pointer to list
  let list;
  let isArtistList = false;

  if (name == settings.artistFilename || name.includes("artist")) {
    list = artists[name];
    isArtistList = true;
  } else list = lists[name];

  return {
    name,
    list,
    isArtistList,
  };
}

/**
 * Pull a random entry from a list, with once-only depletion and auto-reload when
 * the list empties. Artist lists return "" when `includeArtist` is off.
 * @param {object} settings The merged generation settings.
 * @param {string} name The list name or alias.
 * @returns {string} A random list entry, or "".
 */
// Pulls a list entry from a named list
function pull(settings, name) {
  // Convert name to data
  let data = nameToData(settings, name);
  name = data.name;

  // Immidiately stop if artist are disabled when an artist is requested
  if (data.isArtistList && !settings.includeArtist) return "";

  // If list is empty, reload
  // We have to also re-update the list pointer
  if (data.list.length <= 0) {
    reloadListFile(settings, name);
    data = nameToData(settings, name, true);
  }

  // If still empty, return empty string
  if (data.list.length <= 0) return "";

  // Pull random index
  const index = _.random(0, data.list.length - 1);

  // Pull list entry
  const entry = data.list[index];

  // Remove it from the list
  if (settings.listEntriesUsedOnce) data.list.splice(index, 1);

  // If list is empty, reload
  if (data.list.length <= 0) reloadListFile(settings, name);

  // Return list item
  return entry;
}

export default {
  keywordAlias,
  artistAlias,

  reloadListFile,
  reloadListFiles,
  pull,
};
