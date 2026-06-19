/**
 * @file
 * @brief Browser-safe list store: once-only depletion and alias resolution behind the injected loader.
 */

import _ from "lodash";
import { keywordAlias, artistAlias } from "../helpers/aliases.js";

// Loader-backed port of helpers/listFiles.js's pull/depletion logic, made
// data-source-agnostic: the working list copies come from `loader.readListLines`
// (fs in Node, bundled ?raw text in the browser) instead of reading files here.
// Keeps the once-only depletion + alias resolution behaviour of the original.
/**
 * Create a loader-backed list store with the original once-only depletion + alias behaviour.
 * @param {object} loader Data loader (`readListLines`, `listNames`).
 * @returns {{pull: Function, reset: Function}} The store API.
 */
export function createListStore(loader) {
  const lists = {};
  const artists = {};

  function isArtistName(settings, name) {
    return name == settings.artistFilename || name.includes("artist");
  }

  function bucket(settings, name) {
    return isArtistName(settings, name) ? artists : lists;
  }

  function ensureLoaded(settings, name) {
    const target = bucket(settings, name);
    if (target[name] === undefined) {
      const lines = loader.readListLines(name);
      target[name] = lines ? [...lines] : [];
    }
    return target;
  }

  function resolveName(settings, name) {
    if (name == keywordAlias && String(settings.keywordsFilename) != "false")
      return settings.keywordsFilename;
    if (name == artistAlias && String(settings.artistFilename) != "false")
      return settings.artistFilename;
    if (name == keywordAlias && String(settings.keywordsFilename) == "false")
      return _.sample(loader.listNames().filter((n) => !isArtistName(settings, n)));
    if (name == artistAlias && String(settings.artistFilename) == "false")
      return _.sample(loader.listNames().filter((n) => isArtistName(settings, n)));
    return name;
  }

  function reload(settings, name) {
    const target = bucket(settings, name);
    const lines = loader.readListLines(name);
    target[name] = lines ? [...lines] : [];
    return target[name];
  }

  /**
   * Pull a random entry from list `name` (alias-resolved), with once-only depletion.
   * @param {object} settings The merged settings.
   * @param {string} name The list name or alias.
   * @returns {string} A random entry, or "".
   */
  function pull(settings, name) {
    name = resolveName(settings, name);
    if (name === undefined || name === null) return "";

    if (isArtistName(settings, name) && !settings.includeArtist) return "";

    const target = ensureLoaded(settings, name);
    let list = target[name];

    if (list.length <= 0) list = reload(settings, name);
    if (list.length <= 0) return "";

    const index = _.random(0, list.length - 1);
    const entry = list[index];

    if (settings.listEntriesUsedOnce) list.splice(index, 1);
    if (list.length <= 0) reload(settings, name);

    return entry;
  }

  /**
   * Clear depletion state — call once per generated prompt so each draws from a full set.
   * @returns {void}
   */
  // Clear depletion state — call once per generated prompt so each prompt draws
  // from a full set of list entries.
  function reset() {
    for (const k of Object.keys(lists)) delete lists[k];
    for (const k of Object.keys(artists)) delete artists[k];
  }

  return { pull, reset };
}
