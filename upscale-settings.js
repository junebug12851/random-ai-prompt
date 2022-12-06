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

/////////////////////////////////////
/// DONT ADJUST SETTINGS HERE
/// ADJUST SETTINGS IN user-settings.js
/////////////////////////////////////

// For when asking the script to use the WebUI API to upscale the generated images

module.exports = {

	// Whether to save before upscale
	/*--upscale-save-before <true/false>*/
	saveBeforeUpscale: true,

	// Upscale by amount or to a specific size
	/*--upscale-to-size <true/false>*/
	upscaleToSize: true,

	// Restore Faces with GFPGAN Percent
	/*--upscale-gfpgan <0.0-1.0>*/
	faceRestoreGfpgan: 0.0,

	// Restore faces with Code Former Percent
	/*--upscale-code-former <0.0-1.0>*/
	faceRestoreCodeFormer: 0.0,

	// Balance between GFPGAN and CodeFormer Percent
	/*--upscale-code-former-weight <0.0-1.0>*/
	codeFormerWeight: 0.0,

	// Upscale by this amount, only useful if upscaleToSize is false
	// Stable Diffusion limits this to a max of 4.0 for some reason despite the WebUI allwoing further
	/*--upscale-by <number>*/
	upscaleBy: 4.0,

	// Upscale to this size, only useful if upscaleToSize is true
	/*--upscale-to-width <number>*/
	/*--upscale-to-height <number>*/
	upscaleToWidth: 1920,
	upscaleToHeight: 1080,

	// When upscaling to a size, auto-crop it
	/*--upscale-crop <true/false>*/
	autoCrop: true,

	// Upscalers to use
	/*--upscaler-1 <name>*/
	/*--upscaler-2 <name>*/
	upscaler1: "ESRGAN_4x",
	upscaler2: "None",

	// Percent of Upscaler 2 to apply
	/*--upscaler-2-weight <0.0-1.0>*/
	upscaler2Percentage: 0.0,

	// Fix faces after upscaling
	/*--upscale-late-face-restore <true/false>*/
	fixFacesLast: false
}
