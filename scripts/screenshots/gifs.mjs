/**
 * @file
 * The GIF registry. Each animated walkthrough is an authored scenario module in `scenarios/`; add a
 * new one by writing that module and listing it here. This is the "manually say what each GIF is"
 * surface — the toolkit never invents GIFs, it only renders the ones registered below.
 * @module scripts/screenshots/gifs
 */
import promptBlocks from "./scenarios/prompt-blocks.mjs";

/**
 * @typedef {object} GifScenario
 * @property {string} name          Output file stem (`<name>.gif`).
 * @property {string} title         Human title for the index.
 * @property {string} description   One-line description for the index.
 * @property {string} viewport      Which {@link module:scripts/screenshots/config.VIEWPORTS} key to record at.
 * @property {number} durationMs    Target total run time of the animation.
 * @property {string} clipSelector  The element whose box is captured for every frame.
 * @property {(page: import("@playwright/test").Page, rec: import("./frames.mjs").Recorder) => Promise<void>} run
 */

/**
 * The registered GIF scenarios, in publish order.
 * @type {GifScenario[]}
 */
export const GIFS = [promptBlocks];
