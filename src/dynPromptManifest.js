/**
 * @file
 * @brief Dynamic-prompt metadata + group/wildcard resolution helpers — the analog of
 * listManifest.js for the `data/dynamic-prompts/` catalog. Pure data + tiny resolvers,
 * browser-safe (no Node-only imports), so it runs in Node and the Vite SPA alike.
 *
 * Unlike lists, dynamic prompts are NOT word pools you draw from, so there are no group
 * entry lists — a category folder is organization only, never a `{#folder}` "random
 * member" group. The single exception is the reserved `{#any}` wildcard, which runs one
 * random generator from the whole v2 catalog (a deliberate "surprise me", parity with the
 * lists' reserved `{keyword}`). Gating is automatic by name token via gatedLists.js.
 */

/**
 * Reserved wildcard base: `{#any}` is not a file — it runs a random generator drawn from
 * the whole v2 catalog (mode/gate-aware). Reserved like the lists' `{keyword}`.
 * @type {string}
 */
export const RESERVED_ANY = "any";

/**
 * @param {string} name A dynamic-prompt reference.
 * @returns {boolean} Whether it is the reserved `{#any}` wildcard.
 */
export function isReservedAny(name) {
  return String(name) === RESERVED_ANY;
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
