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

// For when asking the script to use the WebUI API to generate images

module.exports = {

	// Change this if your WebUI runs on a different port or on a different computer
    /*--webui-url <url>*/
	url: "http://127.0.0.1:7860",

	// Where to save images to
    /*--image-save-to <path>*/
	saveTo: "./output",

    // Sampler name
    /*--image-sampler <sampler>*/
    sampler: "Euler",

    // Sampler steps to use for each image
    /*--image-steps <steps>*/
    steps: 32,

    // Image width and height
    /*--image-width <width>*/
    /*--image-height <height>*/
    width: 512,
    height: 512,

    // Auto restore faces
    /*--image-restore-faces <true/false>*/
    restoreFaces: false,

	// Denoising Strength
	// Only applicable for high-res fix
    /*--image-denoising <0.0-1.0>*/
    denoising: 0.7,

    // Images to generate per prompt
    /*--images-per-prompt <number>*/
    batchCount: 1,

    // CFG to use for each image
    /*--image-cfg <number>*/
    cfg: 11.0,

    // Seed for each image, use -1 for random seeds
    /*--image-seed <number>*/
    seed: -1,

    // For image variations using --file-variations <fileID>
    // Amount of variation between images
    // This will not apply if not using file-variations
    /*--image-subseed-strength <0.0-1.0>*/
    subseedStrength: 0.05,

    // Animation delay for animated images in ms
    /*--animation-delay <number>*/
    animationDelay: 200,

    // The default start animation frame
    // For best results leave at 1
    /*--animation-starting-frame <number>*/
    animationStartFrame: 1,

    // The default animation frame count
    /*--animation-frames <number>*/
    animationFrameCount: 5,

    // Negative prompt
    /*--negative-prompt <prompt>*/
    negativePrompt: "overexposed, asymmetrical, writing, deformed wings, low quality, text, extra arms, username, extra legs, low quality text, error, lowres, missing fingers, extra digit, fewer digits, cropped, worst quality, normal quality, jpeg artifacts, signature, out of focus, missing limbs, gross, distorted eyes, unfinished eyes, asymmetrical eyes, low quality eyes, bad hands, artist name, b&w, weird colors, blurry, oversize head, amputations, lumpy, extra limbs, extra fingers, mutated hands, bad anatomy, bad proportions, feral, border, extra nipples, trademark, watermark, mutations, tiling, deformed, head cropped, fusion, face cropped, face out of frame, censored, imperfections, disfigured, out of frame, deformed breasts, deformed hands, bad art, extra head, asymmetrical body, crosseyed, body out of frame, cross-eye, ugly, mutation, mutated, poorly drawn face, washed out colors, desaturated colors, faded colors, greyscale, poorly drawn, nsfw, lewd, ecchi, hentai, pervert, softcore, explicit, erotic, nudity, nipples, panties, bra, genitalia, bdsm, bondage, bra, lingerie",
}
