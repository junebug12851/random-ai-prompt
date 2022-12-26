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

// Imports
const fetch = require('node-fetch');
const cliProgress = require('cli-progress');

// Bring in shared code
const doUpscale = require("../helpers/imageUpscaler");
const saveImage = require("../helpers/saveImage");

// Import image settings
let imageSettings;
let index = 0;
let total = 0;
let realbatchCount = 0;

let ongoingProgress = false;
const updateFreq = 500;

// Make progress bars
const progressBars = new cliProgress.MultiBar({
    barCompleteChar: '\u2588',
    barIncompleteChar: ' ',
    hideCursor: true,
    clearOnComplete: true,
    fps: 2
});

let renderProgressBar;
let batchProgressBar;
let promptProgressBar;
let samplerProgressBar;

async function updateProgress() {
	let data;

	try {
		const response = await fetch(`${imageSettings.url}/sdapi/v1/progress`);
		data = await response.json();
	}
	catch(err) {
		if(ongoingProgress && renderProgressBar != undefined)
			renderProgressBar.update(null, {
				err: "Error getting progress"
			});
		// else
		// 	console.error("Error");
	}

	// If data is empty then stop here
	if(data === undefined && ongoingProgress) {
		setTimeout(updateProgress, updateFreq);
		return;
	}
	else if(!ongoingProgress)
		return;

	// Extract progress and convert to integer
	const progress = Math.trunc(data.progress * 100);
	const sdEta = Math.trunc(data.eta_relative) + "s";

	// Update progress bar
	renderProgressBar.update(progress, {
		err: "",
		sdEta
	});

	batchProgressBar.update(data.state.job_no + 1, {
		jobNo: data.state.job_no + 1,
		jobCount: realbatchCount
	});

	samplerProgressBar.update(data.state.sampling_step + 1, {
		samplingStep: data.state.sampling_step + 1,
		samplingSteps: imageSettings.steps
	});

	// Save Current Progress
	imageSettings.progressPercent = progress;
	imageSettings.progressEta = sdEta;
	imageSettings.progressCurImg = data.state.job_no;
	imageSettings.progressTotalImg = realbatchCount;
	imageSettings.progressCurStep = data.state.sampling_step + 1;
	imageSettings.progressTotalSteps = imageSettings.steps;

	// Schedule another update
	setTimeout(updateProgress, updateFreq);
}

function startProgress() {
	ongoingProgress = true;

	samplerProgressBar = progressBars.create(imageSettings.steps, 1, {
		samplingStep: 1,
		samplingSteps: imageSettings.steps
	}, {
		format: '      Image: [' + '{bar}' + '] {percentage}% {samplingStep}/{samplingSteps}',
	});

	batchProgressBar = progressBars.create(realbatchCount, 1, {
		jobNo: 1,
		jobCount: realbatchCount
	}, {
		format: 'Image Batch: [' + '{bar}' + '] {percentage}% {jobNo}/{jobCount}',
	});

	renderProgressBar = progressBars.create(100, 0, {
		sdEta: "--s",
		err: ""
	}, {
		format: 'Image Total: [' + '{bar}' + '] {percentage}% ETA: {sdEta}, Elapsed: {duration_formatted} {err}',
	});

	promptProgressBar = progressBars.create(total, index + 1, {
		index: index + 1,
		total
	}, {
		format: '    Prompts: [' + '{bar}' + '] {percentage}% {index}/{total}',
	});

	imageSettings.progressOngoing = true;
	imageSettings.progressPercent = 0;
	imageSettings.progressEta = 0;
	imageSettings.progressCurImg = 1;
	imageSettings.progressTotalImg = realbatchCount;
	imageSettings.progressCurStep = 1;
	imageSettings.progressTotalSteps = imageSettings.steps;
	imageSettings.progressCurPrompt = index + 1;
	imageSettings.progressTotalPrompts = total;

	setTimeout(updateProgress, updateFreq);
}

function stopProgress() {
	ongoingProgress = false;

	progressBars.remove(samplerProgressBar);
	progressBars.remove(batchProgressBar);
	progressBars.remove(renderProgressBar);
	progressBars.remove(promptProgressBar);

	imageSettings.progressOngoing = false;
	imageSettings.progressPercent = null;
	imageSettings.progressEta = null;
	imageSettings.progressCurImg = null;
	imageSettings.progressTotalImg = null;
	imageSettings.progressCurStep = null;
	imageSettings.progressTotalSteps = null;
	imageSettings.progressCurPrompt = null;
	imageSettings.progressTotalPrompts = null;

	progressBars.stop();
}

module.exports = async function(prompt, _index, _total, settings, _imageSettings, upscaleSettings) {

	// Copy image settings globally
	imageSettings = _imageSettings;
	index = _index;
	total = _total;

	// Save real batch count
	realbatchCount = imageSettings.batchCount;

	// If high-Res fix is enabled, double batch count as it requires 2 iterations
	// for a single image
	if(imageSettings.width > 512 || imageSettings.height > 512)
		realbatchCount *= 2;

	// Convert image settings over to a format WebUI can understand
	// To have accurate variations, it's very important to disbale subseed usage
	// unless your doing variations. Refuse to enable subseed strength unless this is a variation
	const postData = {
		enable_hr: (imageSettings.width > 512 || imageSettings.height > 512),
		denoising_strength: imageSettings.denoising,
		seed: imageSettings.seed,
		sampler_index: imageSettings.sampler,
		n_iter: imageSettings.batchCount,
		steps: imageSettings.steps,
		cfg_scale: imageSettings.cfg,
		width: imageSettings.width,
		height: imageSettings.height,
		restore_faces: imageSettings.restoreFaces,
		prompt,
		negative_prompt: imageSettings.negativePrompt,
		seed_resize_from_w: (imageSettings.seedWidth === undefined) ? -1 : imageSettings.seedWidth,
		seed_resize_from_h: (imageSettings.seedHeight === undefined) ? -1 : imageSettings.seedHeight,
		subseed_strength: (imageSettings.seedWidth === undefined) ? 0.0 : imageSettings.subseedStrength,
	};

	// Holds WebUI response data
	let data;

	// Start progress tracking
	startProgress();

	// Send response
	try {
		const response = await fetch(`${imageSettings.url}/sdapi/v1/txt2img`, {
			method: 'post',
			body: JSON.stringify(postData),
			headers: {'Content-Type': 'application/json'}
		});

		data = await response.json();
	}
	catch(err) {
		console.log("An error has occured when asking WebUI to generate images");
		throw err;
	}

	// Stop progress tracking
	stopProgress();

	// Parse WebUI response info
	let originalInfo = JSON.parse(data.info);

	// Create a much cleaned up version
	let info = JSON.parse(data.info);
	delete info.all_prompts;
	delete info.all_negative_prompts;
	delete info.all_seeds;
	delete info.all_subseeds;
	delete info.infotexts;

	// Save orig prompt
	info.origPrompt = (settings.origPrompt) ? settings.origPrompt : settings.prompt;

	// Add fx and artists if they were automatically added
	if(imageSettings.autoIncludedFx)
		info.origPrompt += ", #fx";

	if(imageSettings.autoIncludedArtists)
		info.origPrompt += ", #artists";

	// Convert image data to actual images
	for(let i = 0; i < data.images.length; i++) {

		// Get Base64 PNG
		const pngBase64 = data.images[i];

		// Adjust cleaned up response info for this image
		info.seed = originalInfo.all_seeds[i];
		info.subseed = originalInfo.all_subseeds[i];

		// Name of saved image
		let saveName;

		// Save regular image if configured to do so
		if(!settings.upscaleImages)
			saveName = saveImage(pngBase64, info, imageSettings, false);
		else if(settings.upscaleImages && upscaleSettings.saveBeforeUpscale)
			saveName = saveImage(pngBase64, info, imageSettings, false);
		else if(settings.upscaleImages && !upscaleSettings.saveBeforeUpscale)
			saveName = false

		// Upscale if configured to do so
		if(settings.upscaleImages)
			await doUpscale(pngBase64, info, imageSettings, upscaleSettings, saveName);
	}
}
