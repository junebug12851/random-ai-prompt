/**
 * @file
 * @brief Dynamic-prompt metadata — the analog of `listTags` in listManifest.js for the
 * `data/dynamic-prompts/` catalog. Pure data, browser-safe (no Node-only imports).
 *
 * Unlike lists, dynamic prompts are NOT word pools you draw from: every `{#name}` names ONE
 * specific generator script. There are no group entry lists, no `{#folder}` "random member"
 * groups, and no random-pick wildcard. Adult gating is automatic by name token (gatedLists.js).
 */

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
