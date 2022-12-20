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

module.exports = function saveImage(base64Image, info, imageSettings, upscaled) {
	// Convert base64 to buffer
	const pngBuffer = Buffer.from(base64Image, "base64");

	// Get current time
	const epoch = (+new Date()).toString();

	// Make filename
	const filename = (upscaled)
		? `${epoch}-upscaled`
		: `${epoch}`;

	// Save Image
	fs.writeFileSync(`${imageSettings.saveTo}/${filename}.png`, pngBuffer);

	// Write file next to image
	if(info != undefined)
		fs.writeFileSync(`${imageSettings.saveTo}/${filename}.json`, JSON.stringify(info, null, 4));
}
