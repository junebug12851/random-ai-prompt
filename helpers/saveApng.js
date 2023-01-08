const fs = require('fs');
const apng = require("./makeApng");

// Saves the png files as an animated png file
module.exports = function(imageArray, imageSettings, dontWriteJSON) {

	// Read the PNG files into an array of Buffers
	const pngBuffers = imageArray.map(pngFile => fs.readFileSync(`${imageSettings.saveTo}/${pngFile}.png`));

	const apngBuffer = apng(pngBuffers, function(frameIndex) {

		// Same speed for all frames
		// Kind of neat to think about future possibiltiies that may allow for
		// seperate speeds for each frame
		return { numerator: imageSettings.animationDelay, denominator: 1000 };
	});

	// Save the APNG to a file
	// We save with the png extension to make coding much easier
	fs.writeFileSync(`${imageSettings.saveTo}/${imageSettings.animationOf}.png`, apngBuffer);

	// Save image filename
    if(imageSettings.resultImages == undefined)
        imageSettings.resultImages = [];

    imageSettings.resultImages.push(`${imageSettings.animationOf}`);

	if(dontWriteJSON)
		return;

	// Read info file from first file in the array
	const info = JSON.parse(fs.readFileSync(`${imageSettings.saveTo}/${imageArray[0]}.json`).toString());

	// Remove animation frame link to animation key
	delete info.animationFrameOf;

	// Set key that signifies this is the animation the frames link to
	info.isAnimation = true;

	// Set parent image if there is one
	if(imageSettings.animationOfImg != undefined)
		info.animationOf = imageSettings.animationOfImg;

	// Write info file next to image
	fs.writeFileSync(`${imageSettings.saveTo}/${imageSettings.animationOf}.json`, JSON.stringify(info, null, 4));
}
