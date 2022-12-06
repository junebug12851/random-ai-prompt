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

const doUpscale = require("../helpers/imageUpscaler");
const convertMetaToJSON = require("./convertMetaToJSON");

module.exports = async function(name, settings, imageSettings, upscaleSettings) {

	// Read file
	let png = fs.readFileSync(`${imageSettings.saveTo}/${name}.png`);
	png = Buffer.from(png).toString('base64');

	// Read info file
	let txt = fs.readFileSync(`${imageSettings.saveTo}/${name}.txt`).toString();
	
	// Check to see if it's a JSON file or not, convert if it isn't
	if(convertMetaToJSON.check(name, txt, settings, imageSettings, upscaleSettings))
		txt = convertMetaToJSON.convert(name, txt, settings, imageSettings, upscaleSettings);
	else
		txt = JSON.parse(txt);

	// Do upscale
	await doUpscale(png, txt, imageSettings, upscaleSettings);
}
