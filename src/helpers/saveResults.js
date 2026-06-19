/**
 * @file
 * @brief Write results.json: the last run prompts and image names.
 */

import fs from "node:fs";

/**
 * Write `results.json` — the current run's prompts and image names.
 * @param {object} imageSettings The image settings (`resultPrompts`, `resultImages`).
 * @returns {void}
 */
export default function (imageSettings) {
  try {
    // Write results file
    fs.writeFileSync(
      "./results.json",
      JSON.stringify(
        {
          prompts: imageSettings.resultPrompts,
          images: imageSettings.resultImages,
        },
        null,
        4,
      ),
    );
  } catch (err) {
    console.error(err);
  }
}
