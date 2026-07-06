/**
 * @file
 * @brief JS sidecar for animal.dpl — entity() restricted to the animal pool.
 */

import entity from "./entity.js";

/**
 * Generate an animal subject.
 * @param {object} settings Settings.
 * @param {object} imageSettings Image settings.
 * @param {object} upscaleSettings Upscale settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return entity(settings, imageSettings, upscaleSettings, "animal");
}
