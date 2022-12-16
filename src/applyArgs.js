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

const _ = require("lodash");

module.exports = function(argv, settings, imageSettings, upscaleSettings, allSettings) {

	///////////////////////////////
	// Apply presets
	///////////////////////////////
	
	// Check for presets
	if(argv.presets !== undefined) {

		// Load them into an array
		const presets = argv.presets.toString().split(",");

		// Loop through them
		for(let i = 0; i < presets.length; i++) {

			// Grab 1
			const preset = presets[i];

			// Merge it into settings
			_.merge(allSettings, require(`../${settings.presetFiles}/${preset}.json`));
		}
	}

	///////////////////////////////
	// Apply arguments to general settings
	///////////////////////////////

	if(argv.chaos !== undefined) {
		const chaosPercent = parseFloat(argv.chaos);

		settings.emphasisChance *= chaosPercent;
		settings.emphasisLevelChance *= chaosPercent;
		settings.emphasisMaxLevels = Math.round(settings.emphasisMaxLevels * chaosPercent);
		settings.deEmphasisChance *= chaosPercent;
		settings.keywordEditingMin *= chaosPercent;
		settings.keywordEditingMax *= chaosPercent;
		settings.keywordAlternatingMaxLevels *= chaosPercent;
	}

	// Since some people may not want randomness, if this flag is set, it auto
	// sets max count to tbe the same. To keep randomness, specify both.
	if(argv.count !== undefined) {
		settings.keywordCount = parseInt(argv.count);
		settings.keywordMaxCount = settings.keywordCount;
	}

	if(argv.maxCount !== undefined)
		settings.keywordMaxCount = parseInt(argv.maxCount);

	if(argv.prompts !== undefined)
		settings.promptCount = parseInt(argv.prompts);

	if(argv.generateImages !== undefined)
		settings.generateImages = (argv.generateImages == true);

	if(argv.upscaleImages !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = (argv.upscaleImages == true);
	}

	if(argv.hidePrompt !== undefined)
		settings.hidePrompt = (argv.hidePrompt == true);

	if(argv.emphasis !== undefined)
		settings.keywordEmphasis = (argv.emphasis == true);

	if(argv.emphasisChance !== undefined)
		settings.emphasisChance = parseFloat(argv.emphasisChance);

	if(argv.emphasisLevelChance !== undefined)
		settings.emphasisLevelChance = parseFloat(argv.emphasisLevelChance);

	if(argv.emphasisMaxLevels !== undefined)
		settings.emphasisMaxLevels = parseInt(argv.emphasisMaxLevels);

	if(argv.deEmphasisChance !== undefined)
		settings.deEmphasisChance = parseFloat(argv.deEmphasisChance);

	if(argv.editing !== undefined)
		settings.keywordEditing = (argv.editing == true);

	if(argv.editingMin !== undefined)
		settings.keywordEditingMin = argv.editingMin;

	if(argv.editingMax !== undefined)
		settings.keywordEditingMax = argv.editingMax;

	if(argv.alternating !== undefined)
		settings.keywordAlternating = (argv.alternating == true);

	if(argv.alternatingMaxLevels !== undefined)
		settings.keywordAlternatingMaxLevels = parseInt(argv.alternatingMaxLevels);

	if(argv.useArtists !== undefined)
		settings.includeArtist = (argv.useArtists == true);

	if(argv.minArtist !== undefined)
		settings.minArtist = parseInt(argv.minArtist);

	if(argv.maxArtist !== undefined)
		settings.maxArtist = parseInt(argv.maxArtist);

	if(argv.noand !== undefined)
		settings.noAnd = (argv.noand == true);

	if(argv.listFiles !== undefined)
		settings.listFiles = argv.listFiles.toString();

	if(argv.reloadLists !== undefined)
		settings.reloadListsOnPromptChange = (argv.reloadLists == true);

	if(argv.listEntriesOnce !== undefined) {
		settings.listEntriesUsedOnce = (argv.listEntriesOnce == true);

		// If lists are allowed to have duplicates, then there's zero point in
		// reloading the lists on prompt changes
		if(settings.listEntriesUsedOnce == false)
			settings.reloadListsOnPromptChange = false;
	}

	if(argv.artistFilename !== undefined)
		settings.artistFilename = argv.artistFilename.toString();

	if(argv.artists !== undefined)
		settings.artistFilename = argv.artists.toString();

	if(argv.keywordsFilename !== undefined)
		settings.keywordsFilename = argv.keywordsFilename.toString();

	if(argv.dict !== undefined)
		settings.keywordsFilename = argv.dict.toString();

	if(argv.keywords !== undefined)
		settings.keywordsFilename = argv.keywords.toString();

	if(argv.expansionFiles !== undefined)
		settings.expansionFiles = argv.expansionFiles.toString();

	if(argv.presetFiles !== undefined)
		settings.presetFiles = argv.presetFiles.toString();

	if(argv.dynamicPromptFiles !== undefined)
		settings.dynamicPromptFiles = argv.dynamicPromptFiles.toString();

	if(argv.dynPrompts !== undefined)
		settings.dynamicPrompts = [...(argv.dynPrompts.toString().split(",")), ...settings.dynamicPrompts];

	if(argv.allDynPrompts !== undefined)
		settings.dynamicPrompts = argv.allDynPrompts.toString().split(",");

	if(argv.promptSalt !== undefined)
		settings.promptSalt = (argv.promptSalt == true);

	if(argv.promptSaltStart !== undefined)
		settings.promptSaltStart = parseInt(argv.promptSaltStart);

	if(argv.prompt !== undefined) {
		settings.prompt = argv.prompt.toString();
		if(settings.prompt == "true" || settings.prompt == "false")
			settings.prompt = "";
	}

	if(argv.promptPrefix !== undefined) {
		settings.promptPrefix = argv.promptPrefix.toString();
		if(settings.promptPrefix == "true" || settings.promptPrefix == "false")
			settings.promptPrefix = "";
	}

	///////////////////////////////
	// Apply arguments to image settings
	///////////////////////////////
	
	if(argv.webuiUrl !== undefined) {
		settings.generateImages = true;
		imageSettings.url = argv.webuiUrl.toString();
	}

	if(argv.imageSaveTo !== undefined) {
		settings.generateImages = true;
		imageSettings.saveTo = argv.imageSaveTo.toString();
	}

	if(argv.imageSampler !== undefined) {
		settings.generateImages = true;
		imageSettings.sampler = argv.imageSampler.toString();
	}

	if(argv.imageSteps !== undefined) {
		settings.generateImages = true;
		imageSettings.steps = parseInt(argv.imageSteps);
	}

	if(argv.imageWidth !== undefined) {
		settings.generateImages = true;
		imageSettings.width = parseInt(argv.imageWidth);
	}

	if(argv.imageHeight !== undefined) {
		settings.generateImages = true;
		imageSettings.height = parseInt(argv.imageHeight);
	}

	if(argv.imageRestoreFaces !== undefined) {
		settings.generateImages = true;
		imageSettings.restoreFaces = (argv.imageRestoreFaces == true);
	}

	if(argv.imageDenoising !== undefined) {
		settings.generateImages = true;
		imageSettings.denoising = parseFloat(argv.imageDenoising);
	}

	if(argv.imagesPerPrompt !== undefined) {
		settings.generateImages = true;
		imageSettings.batchCount = parseInt(argv.imagesPerPrompt);
	}

	if(argv.imageCfg !== undefined) {
		settings.generateImages = true;
		imageSettings.cfg = parseFloat(argv.imageCfg);
	}

	if(argv.imageSeed !== undefined) {
		settings.generateImages = true;
		imageSettings.seed = parseInt(argv.imageSeed);
	}

	if(argv.imageSubseedStrength !== undefined) {
		settings.generateImages = true;
		imageSettings.subseedStrength = parseFloat(argv.imageSubseedStrength);
	}

	if(argv.negativePrompt !== undefined) {
		settings.generateImages = true;
		imageSettings.negativePrompt = argv.negativePrompt.toString();
		if(imageSettings.negativePrompt == "true" || imageSettings.negativePrompt == "false")
			imageSettings.negativePrompt = "";
	}

	///////////////////////////////
	// Apply arguments to image settings
	///////////////////////////////
	
	if(argv.upscaleSaveBefore !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.saveBeforeUpscale = (argv.upscaleSaveBefore == true);
	}
	
	if(argv.upscaleToSize !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaleToSize = (argv.upscaleToSize == true);
	}

	if(argv.upscaleGfpgan !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.faceRestoreGfpgan = parseFloat(argv.upscaleGfpgan);
	}

	if(argv.upscaleCodeFormer !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.faceRestoreCodeFormer = parseFloat(argv.upscaleCodeFormer);
	}

	if(argv.upscaleCodeFormerWeight !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.codeFormerWeight = parseFloat(argv.upscaleCodeFormerWeight);
	}

	if(argv.upscaleBy !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaleBy = parseFloat(argv.upscaleBy);
	}

	if(argv.upscaleToWidth !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaleToWidth = parseInt(argv.upscaleToWidth);
	}

	if(argv.upscaleToHeight !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaleToHeight = parseInt(argv.upscaleToHeight);
	}

	if(argv.upscaleCrop !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.autoCrop = (argv.upscaleCrop == true);
	}

	if(argv.upscaler1 !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaler1 = argv.upscaler1.toString();
	}

	if(argv.upscaler2 !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaler2 = argv.upscaler2.toString();
	}

	if(argv.upscale2Weight !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.upscaler2Percentage = parseFloat(argv.upscale2Weight);
	}

	if(argv.upscaleLateFaceRestore !== undefined) {
		settings.generateImages = true;
		settings.upscaleImages = true;
		upscaleSettings.fixFacesLast = (argv.upscaleLateFaceRestore == true);
	}

	///////////////////////////////
	// General Error Checking
	///////////////////////////////

	if((imageSettings.width % 64) != 0) {
		throw new Error("Image width must be a multiple of 64")
	}

	if((imageSettings.height % 64) != 0) {
		throw new Error("Image height must be a multiple of 64")
	}
}
