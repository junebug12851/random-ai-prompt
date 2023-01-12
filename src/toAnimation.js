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
const loadVariationData = require("./loadVariationData");

module.exports = function(name, settings, imageSettings, upscaleSettings) {

	// Load variation data
	loadVariationData(name, settings, imageSettings, upscaleSettings);

	// Delete variation specific stuff
	delete imageSettings.variationOf;
	delete imageSettings.seedWidth;
	delete imageSettings.seedHeight;

	// Set the animation frame count to be the prompt count
	// This can be overridden
	settings.promptCount = imageSettings.animationFrameCount;

	// Force prompt salt
	settings.promptSalt = true;

	// Set starting frame #, this can be overridden
	settings.promptSaltStart = imageSettings.animationStartFrame;

	// Store the animation file id to be created
	// It also signifies to the program to handle the prompt and data file
	// differently
	const epoch = (+new Date()).toString();
	imageSettings.animationOf = `${epoch.toString()}-anim`;

	// Store what image this is based on
	imageSettings.animationOfImg = name;

	// Disable auto add artist and fx
	settings.autoAddArtists = false;
	settings.autoAddFx = false;
}
