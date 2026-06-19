/**
 * @file
 * @brief The two built-in list aliases (keyword / artist), kept dependency-free so the dynamic-prompt chain stays browser-safe.
 */

// The two built-in list aliases, kept in their own tiny, dependency-free module.
//
// Splitting these out matters for the browser build: `keywordRepeater.js` only
// needs these constants, and importing them from here (instead of from
// `listFiles.js`, which imports `node:fs`) keeps the whole dynamic-prompt chain
// free of Node-only modules so it can be bundled for the browser. See
// notes/reference/esm-patterns.md and notes/plans/web-migration.md.
export const keywordAlias = "keyword";
export const artistAlias = "artist";
