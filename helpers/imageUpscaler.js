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

const fs = require('fs');
const fetch = require('node-fetch');

const saveImage = require("./saveImage");

module.exports = async function doUpscale(base64Image, info, imageSettings, upscaleSettings, upscaleOf) {

	imageSettings.progressUpscaling = true;

	// Convert image settings over to a format WebUI can understand
	const postData = {
		image: base64Image,
		resize_mode: (upscaleSettings.upscaleToSize) ? 1 : 0,
		show_extras_results: true,
		gfpgan_visibility: upscaleSettings.faceRestoreGfpgan,
		codeformer_visibility: upscaleSettings.faceRestoreCodeFormer,
		codeformer_weight: upscaleSettings.codeFormerWeight,
		upscaling_resize: upscaleSettings.upscaleBy,
		upscaling_resize_w: upscaleSettings.upscaleToWidth,
		upscaling_resize_h: upscaleSettings.upscaleToHeight,
		upscaling_crop: upscaleSettings.autoCrop,
		upscaler_1: upscaleSettings.upscaler1,
		upscaler_2: upscaleSettings.upscaler2,
		extras_upscaler_2_visibility: upscaleSettings.upscaler2Percentage,
		upscale_first: upscaleSettings.fixFacesLast
	};

	// Save upscale dimensions to json file
	let toWidth = upscaleSettings.upscaleToWidth;
	let toHeight = upscaleSettings.upscaleToHeight;

	if(!upscaleSettings.upscaleToSize) {
		toWidth = info.width * upscaleSettings.upscaleBy;
		toHeight = info.height * upscaleSettings.upscaleBy;
	}

	info.upscaleWidth = Math.trunc(toWidth);
	info.upscaleHeight = Math.trunc(toHeight);

	// Save that this is an upscaled image
	info.isUpscale = true;

	// Holds WebUI response data
	let data;

	console.log("Upscaling...");

	// Send response
	try {
		const response = await fetch(`${imageSettings.url}/sdapi/v1/extra-single-image`, {
			method: 'post',
			body: JSON.stringify(postData),
			headers: {'Content-Type': 'application/json'}
		});

		data = await response.json();
	}
	catch(err) {
		console.log("An error has occured when asking WebUI to upscale images");
		throw err;
	}

	// Get Base64 PNG
	const pngBase64 = data.image;

	// Save it as an upscaled version
	saveImage(pngBase64, info, imageSettings, true, upscaleOf);
}
