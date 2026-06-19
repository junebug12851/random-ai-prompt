/*
    Copyright 2022 juenbug12851

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/**
 * @file
 * @brief Write a PNG plus its JSON metadata sidecar (the relationship and provenance fields) and track results. Notes: notes/systems/server.md.
 */

import fs from "node:fs";
import saveResults from "./saveResults.js";

/**
 * Write a generated PNG and its JSON metadata sidecar — stamping the relationship /
 * provenance fields (variationOf, rerollOf, upscaleOf, cmd, origPostPrompt, animation
 * links) — append it to the run results, and track animation frames.
 * @param {string} base64Image The base64 PNG data.
 * @param {object} info The WebUI generation info (mutated with relationship fields).
 * @param {object} imageSettings The image settings (saveTo + relationship context).
 * @param {boolean} upscaled Whether this is an upscaled image.
 * @param {(string|boolean)} [upscaleOf] The file id this upscales, or false to suppress the `-upscaled` suffix.
 * @returns {string} The saved base filename (without extension).
 */
export default function saveImage(base64Image, info, imageSettings, upscaled, upscaleOf) {
  // Convert base64 to buffer
  const pngBuffer = Buffer.from(base64Image, "base64");

  // Get current time
  const epoch = (+new Date()).toString();

  // Make filename
  // Mark as upscaled only if this is an upscale and a non-upscaled version exists
  const filename = upscaled && upscaleOf != false ? `${epoch}-upscaled` : `${epoch}`;

  // Save Image
  fs.writeFileSync(`${imageSettings.saveTo}/${filename}.png`, pngBuffer);

  // Save into info file what this is a variation of
  if (info != undefined && imageSettings.variationOf != undefined)
    info.variationOf = imageSettings.variationOf;

  if (info != undefined && imageSettings.rerollOf != undefined)
    info.rerollOf = imageSettings.rerollOf;

  // If generating an image with auto-upscaler turned on for new images
  // and asked to save the image before hand, we can link to that image
  if (info != undefined && upscaleOf != undefined && typeof upscaleOf == "string")
    info.upscaleOf = upscaleOf;

  if (info != undefined && imageSettings.lastCmd != undefined) info.cmd = imageSettings.lastCmd;

  if (info != undefined && imageSettings.origPostPrompt != undefined)
    info.origPostPrompt = imageSettings.origPostPrompt;

  // Save fake animation filename
  if (info != undefined && imageSettings.animationOf != undefined) {
    info.animationFrameOf = imageSettings.animationOf;
    info.animatonFrameNumber = imageSettings.usedSalt;
  }

  // Write file next to image
  if (info != undefined)
    fs.writeFileSync(`${imageSettings.saveTo}/${filename}.json`, JSON.stringify(info, null, 4));

  // Save image filename
  if (imageSettings.resultImages == undefined) imageSettings.resultImages = [];

  imageSettings.resultImages.push(filename);
  saveResults(imageSettings);

  if (imageSettings.animationFrames == undefined && imageSettings.animationOf != undefined)
    imageSettings.animationFrames = [];

  if (imageSettings.animationFrames != undefined) {
    imageSettings.animationFrames.push(filename);
  }

  // Return filename
  return filename;
}
