const fs = require("fs");

module.exports = function(imageSettings) {

    try {
    	// Write results file
        fs.writeFileSync("./results.json", JSON.stringify({
            prompts: imageSettings.resultPrompts,
            images: imageSettings.resultImages,
        }, null, 4));
    }
    catch(err) {
        console.error(err);
    }
}
