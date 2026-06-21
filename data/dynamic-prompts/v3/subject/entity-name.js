/**
 * @file
 * @brief JS sidecar for entity-name.dpl — entity() name-only (no emotion/hair/clothes).
 */

import entity from "./entity.js";

/**
 * Generate just an entity name token.
 * @param {object} settings Settings.
 * @param {object} imageSettings Image settings.
 * @param {object} upscaleSettings Upscale settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return entity(settings, imageSettings, upscaleSettings, undefined, true);
}
