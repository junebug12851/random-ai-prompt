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

const fs = require("fs");
const convertMetaToJSON = require("./convertMetaToJSON");

module.exports = function(name, settings, imageSettings, upscaleSettings) {
	console.log(`Loading Settings from File ID: ${name}`);

	let txt;

	// Check to see if it's a JSON file or not, convert if it isn't
	if(convertMetaToJSON.check(name, imageSettings))
		txt = convertMetaToJSON.convert(name, undefined, settings, imageSettings, upscaleSettings);
	else
		txt = require(`../${imageSettings.saveTo}/${name}.json`);

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
	imageSettings.variationOf = name.toString();

	// Load in original prompt
	settings.origPrompt = txt.origPrompt;

	// Set variation settings to get accurate variations
	// Maintain seed width and height if already present, otherwise ignore
	imageSettings.seedWidth = (txt.seed_resize_from_w < 0)
		? txt.width
		: txt.seed_resize_from_w;

	imageSettings.seedHeight = (txt.seed_resize_from_h < 0)
		? txt.height
		: txt.seed_resize_from_h;

	// Ensure generate images is enabled
	settings.generateImages = true;
}
