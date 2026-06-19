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
 * @brief Loads a saved image metadata to seed a subseed variation run.
 */

import fs from "node:fs";
import convertMetaToJSON from "./convertMetaToJSON.js";

/**
 * Load a saved image's metadata sidecar and apply it (seed, size, prompts) so the
 * next run produces subseed variations of that image. Forces `generateImages`.
 * @param {string} name The source image file id.
 * @param {object} settings The merged generation settings (mutated).
 * @param {object} imageSettings The image settings (mutated).
 * @param {object} upscaleSettings The upscale settings.
 * @returns {void}
 */
export default function (name, settings, imageSettings, upscaleSettings) {
  console.log(`Loading Settings from File ID: ${name}`);

  let txt;

  // Check to see if it's a JSON file or not, convert if it isn't
  if (convertMetaToJSON.check(name, imageSettings))
    txt = convertMetaToJSON.convert(name, undefined, settings, imageSettings, upscaleSettings);
  else txt = JSON.parse(fs.readFileSync(`${imageSettings.saveTo}/${name}.json`, "utf8"));

  // Load in Core Settings
  settings.prompt = txt.prompt;
  imageSettings.negativePrompt = txt.negative_prompt;
  imageSettings.seed = txt.seed;
  imageSettings.sampler = txt.sampler_name;
  imageSettings.cfg = txt.cfg_scale;
  imageSettings.steps = txt.steps;
  imageSettings.restoreFaces = txt.restore_faces;
  imageSettings.width = txt.width;
  imageSettings.height = txt.height;
  imageSettings.denoising = txt.denoising_strength;
  imageSettings.variationOf =
    txt.variationOf != undefined ? txt.variationOf.toString() : name.toString();

  // Load in original prompts
  settings.origPrompt = txt.origPrompt;
  imageSettings.origPostPrompt = txt.origPostPrompt;
  settings.randomPrompt = txt.origRandomPrompt;

  // Set variation settings to get accurate variations
  // Maintain seed width and height if already present, otherwise ignore
  imageSettings.seedWidth = txt.seed_resize_from_w < 0 ? txt.width : txt.seed_resize_from_w;

  imageSettings.seedHeight = txt.seed_resize_from_h < 0 ? txt.height : txt.seed_resize_from_h;

  // Ensure generate images is enabled
  settings.generateImages = true;
}
