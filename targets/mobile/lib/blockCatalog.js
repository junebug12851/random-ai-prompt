/**
 * The mobile target's view of the engine's building-block catalog.
 *
 * This used to be a 218-line HAND-PORT of the web's `getBlocks` — with **no drift check at all**,
 * which is worse than a guarded copy, not better: the web could add a category rule, change the NSFW
 * predicate or reorder the pills and nothing would have noticed the phone falling behind.
 *
 * The catalog is ENGINE domain (it describes the engine's own content pools, their folder categories,
 * the virtual `{#any}` / `{keyword}` wildcards and the NSFW gate) and is a pure function of a loader,
 * so it lives in `engine/blockCatalog.js` and each target simply binds its own loader. Here that's the
 * Metro static-catalog loader. See `notes/plans/de-duplication.md`.
 */
import { metroLoader as loader } from "engine/core/metroLoader.js";
import { buildBlocks, buildDplCompletions } from "engine/blockCatalog.js";

/**
 * The categorized building-block groups for the palette: Blocks (the generators) and Lists.
 * Recomputed on each call, so a Manage edit (which refreshes the metroLoader overlay) is reflected.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] When false (default), NSFW generators are hidden entirely.
 * @returns {object[]} The Blocks + Lists groups.
 */
export function getBlocks(opts = {}) {
  return buildBlocks(loader, opts);
}

/**
 * Flatten the catalog into autocomplete entries for the mobile DPL editor's completion strip.
 * @returns {object[]} The completion entries.
 */
export function getDplCompletions() {
  return buildDplCompletions(loader);
}