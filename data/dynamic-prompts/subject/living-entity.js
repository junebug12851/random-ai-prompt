/**
 * @file
 * @brief JS sidecar for living-entity.dpl — entity() restricted to the living pool.
 */

import entity from "./entity.js";

/**
 * Generate a living-entity subject.
 * @param {object} settings Settings.
 * @param {object} imageSettings Image settings.
 * @param {object} upscaleSettings Upscale settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return entity(settings, imageSettings, upscaleSettings, "living");
}
