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

function find(regex, str, def) {
	let ret = str.match(regex);

	if(ret == null)
		return def;

	if(ret.length >= 2)
		ret = ret[1];
	else
		ret = def;

	return ret;
}

/*
 * Data is pretty flexible but it must be in this format
 * 1st line must be the prompt, it can optionally start with Prompt
 * 2nd line must be the negative prompt, it can optionally start with Negative prompt
 * 3rd line onward is much more flexible, it just nneds to contain settings and 
 * they can be on one line or spread out
*/

function breakdownData(txt, name, settings, imageSettings, upscaleSettings) {

	// Ret object to build
	const ret = {};

	// Ensure the array is at least 3 strings, even if their empty
	if(txt.length < 3) {
		txt.length = 3;

		for(let i = 0; i < txt.length; i++) {
			if(txt[i] == undefined || txt[i] == null)
				txt[i] = "";
		}
	}

	// Add an emty newline at end
	txt.push("");

	// Get prompt which is always at the beginning, it's also usually unlabeled
	// So the only thing we have to go by is it's at the beginning
	ret.prompt = find(/(?:Prompt)?:? ?(.*)\n?/mi, txt[0], "");

	// Remove positive prompt
	txt.shift();

	// Get negative prompt which is always 2nd, it's also usually labeled
	ret.negative_prompt = find(/(?:Negative Prompt)?:? ?(.*)\n?/mi, txt[0], "");

	// Remove negative prompt
	txt.shift();

	// Re-put back together
	txt = txt.join("\n");

	// Locate other properties
	ret.steps = parseInt(find(/Steps: ?(.*?)[,\n]/mi, txt, 32));
	ret.sampler_name = find(/Sampler: ?(.*?)[,\n]/mi, txt, "Euler");
	ret.cfg_scale = parseFloat(find(/CFG ?(?:scale)?: ?(.*?)[,\n]/mi, txt, 11));
	ret.seed = parseInt(find(/Seed: ?(.*?)[,\n]/mi, txt, -1));

	// Get size, can be "Size" or "Width" and "Height"
	let size = find(/Size: ?(.*?)[,\n]/mi, txt);
	let width;
	let height;
	if(size == undefined) {
		width = parseInt(find(/Width: ?(.*?)[,\n]/mi, txt, 512));
		height = parseInt(find(/Height: ?(.*?)[,\n]/mi, txt, 512));
	}
	else {
		size = size.toLowerCase().split("x");

		if(size.length < 2)
			size.length = 2;

		width = parseInt((size[0] == undefined || size[0] == null) ? 512 : size[0]);
		height = parseInt((size[1] == undefined || size[1] == null) ? 512 : size[1]);
	}

	ret.width = width;
	ret.height = height;

	// Model hash, defaults to SD 1.4
	ret.sd_model_hash = find(/(?:Model)? ?hash: ?(.*?)[,\n]/mi, txt, "7460a6fa");

	// Model, defaults to model.ckpt
	ret.sd_model = find(/Model: ?(.*?)[,\n]/mi, txt, "model.ckpt");

	// Face restoration
	ret.face_restoration_model = find(/Face (?:restoration|restore): ?(.*?)[,\n]/mi, txt, null);
	if(ret.face_restoration_model != null)
		ret.restore_faces = true;
	else
		ret.restore_faces = false;

	// Denoising Strength
	ret.denoising_strength = parseFloat(find(/Denoising ?(?:strength)?: ?(.*?)[,\n]/mi, txt, 0.7));

	// Subseed
	ret.subseed = parseInt(find(/Subseed: ?(.*?)[,\n]/mi, txt, -1));

	// Subseed Strength
	ret.subseed_strength = parseFloat(find(/Subseed Strength: ?(.*?)[,\n]/mi, txt, 0.0));

	// Batch Size
	ret.batch_size = parseInt(find(/Batch ?(?:Size)?: ?(.*?)[,\n]/mi, txt, 1));

	// Seed Size
	// Can be "Size" or "Width" and "Height"
	size = find(/Seed (?:Resize from)? ?Size: ?(.*?)[,\n]/mi, txt);
	width;
	height;
	if(size == undefined) {
		width = parseInt(find(/Seed (?:Resize from)? ?Width: ?(.*?)[,\n]/mi, txt, -1));
		height = parseInt(find(/Seed (?:Resize from)? ?Height: ?(.*?)[,\n]/mi, txt, -1));
	}
	else {
		size = size.toLowerCase().split("x");

		if(size.length < 2)
			size.length = 2;

		width = parseInt((size[0] == undefined || size[0] == null) ? -1 : size[0]);
		height = parseInt((size[1] == undefined || size[1] == null) ? -1 : size[1]);
	}

	ret.seed_resize_from_w = width;
	ret.seed_resize_from_h = height;

	// Extra stuff to throw in
	ret.extra_generation_params = {};
	ret.index_of_first_image = 0;
	ret.styles = [],
	ret.job_timestamp = name;
	ret.clip_skip = 1;
	ret.is_using_inpainting_conditioning = false;

	return ret;
}

function convert(name, txt, settings, imageSettings, upscaleSettings) {
	console.log(`Converting Plain Data from File ID: ${name} to JSON Data...`);

	// Read info file and split into multiple lines, remove annoying windows line endings
	if(txt === undefined)
		txt = fs.readFileSync(`${imageSettings.saveTo}/${name}.txt`).toString().replaceAll("\r", "");

	txt = txt.split("\n");

	// Breakdown data into expected JSON
	txt = breakdownData(txt, name, settings, imageSettings, upscaleSettings);

	// Replace file with proper JSON file
	fs.unlinkSync(`${imageSettings.saveTo}/${name}.txt`);
	fs.writeFileSync(`${imageSettings.saveTo}/${name}.json`, JSON.stringify(txt, null, 4));

	// Announce done
	console.log("Done converting!")

	// Return converted data
	return txt;
}

function check(name, imageSettings) {
	// If there's a txt file there then it's unconverted
	return fs.existsSync(`${imageSettings.saveTo}/${name}.txt`);
}

module.exports = {
	convert,
	check,
};
