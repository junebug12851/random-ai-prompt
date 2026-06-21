/**
 * @file
 * @brief Dynamic-prompt metadata + group/wildcard helpers — the analog of listManifest.js
 * for the `data/dynamic-prompts/` catalog. Pure data + tiny resolvers, browser-safe (no
 * Node-only imports), so it runs in Node and the Vite SPA alike.
 *
 * Like lists, a category FOLDER with 2+ generators is an IMPLIED group, but the "pick one"
 * picks ONE GENERATOR (not one word): `{#scene}` runs one random scene generator. The
 * reserved `{#any}` wildcard (and `{#any-sfw}` / `{#any-nsfw}`) picks one generator from the
 * WHOLE v2 catalog — the generator-level analog of the lists' `{keyword}` wildcard. Gating
 * is automatic by name token via gatedLists.js.
 */

import { autoGroupListDirs } from "./listManifest.js";

/**
 * Reserved wildcard base: `{#any}` (and `{#any-sfw}` / `{#any-nsfw}`) is not a file — it
 * runs one random generator drawn from the whole v2 catalog, mode-aware. Reserved like the
 * lists' `{keyword}`.
 * @type {string}
 */
export const RESERVED_ANY = "any";

/**
 * @param {string} name A dynamic-prompt reference (may carry a `-sfw`/`-nsfw` suffix).
 * @returns {boolean} Whether it is the reserved `{#any}` wildcard (any variant).
 */
export function isReservedAny(name) {
  return String(name).replace(/-(sfw|nsfw)$/i, "") === RESERVED_ANY;
}

/**
 * Per-generator tag metadata (the analog of `listTags`): a category plus anime/nsfw
 * flags, for UI badges and docs. The category is normally derivable from the folder; this
 * map only needs entries that carry extra flags. Anything absent defaults to
 * `{ anime:false, nsfw:false }`.
 * @type {Object<string,{category?:string,anime?:boolean,nsfw?:boolean}>}
 */
export const dynPromptTags = {
  "v2/engine/danbooru": { category: "engine", anime: true, nsfw: false },
};

/**
 * The category folders that are IMPLIED groups: a v2 folder with 2+ generators. Reuses the
 * list rule (`autoGroupListDirs`) over the v2 names only (v1/ is excluded — it is reached
 * via `{#name-v1}`, never grouped). Marker dirs force a folder on/off.
 * @param {string[]} names All dynamic-prompt catalog names.
 * @param {string[]} [enableDirs] Folders forced on (`_enable-group-list`).
 * @param {string[]} [disableDirs] Folders forced off (`_disable-group-list`).
 * @returns {string[]} The implied-group folder paths.
 */
export function dynGroupDirs(names, enableDirs = [], disableDirs = []) {
  return autoGroupListDirs(
    names.filter((n) => !n.startsWith("v1/")),
    enableDirs,
    disableDirs,
  );
}

/**
 * Direct-child generator names of a group folder (NOT descendants — groups don't stack).
 * @param {string} dir The folder path (e.g. "v2/scene").
 * @param {string[]} names All dynamic-prompt catalog names.
 * @returns {string[]} The member generator keys.
 */
export function dynGroupMembers(dir, names) {
  return names.filter((n) => n.startsWith(`${dir}/`) && !n.slice(dir.length + 1).includes("/"));
}
