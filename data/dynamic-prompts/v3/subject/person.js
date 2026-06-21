/**
 * @file
 * @brief JS sidecar for person.dpl — entity() restricted to the human pool.
 */

import entity from "./entity.js";

/**
 * Generate a person subject.
 * @param {object} settings Settings.
 * @param {object} imageSettings Image settings.
 * @param {object} upscaleSettings Upscale settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return entity(settings, imageSettings, upscaleSettings, "human");
}
