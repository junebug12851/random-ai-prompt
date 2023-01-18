const fs = require("fs");

module.exports = function(imageSettings) {
	// Write results file
    fs.writeFileSync("./results.json", JSON.stringify({
        prompts: imageSettings.resultPrompts,
        images: imageSettings.resultImages,
    }, null, 4));
}
