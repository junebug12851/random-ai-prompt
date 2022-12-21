const fs = require("fs");
const path = require("path");
const _ = require("lodash");

// Memory index
// key = keyword: value = array of image file names
let index = {};

// key = baseFilename, value = json + relative path to file
let files = {};

// Index the txt files
const indexFile = function(settings, filePath) {
    // Make sure it's a json file
    const ext = path.extname(filePath).substring(1);
    if(ext != "json")
        return;

    // Break path down
    const filePathParsed = path.parse(filePath);

    // Get path components
    const basePath = path.join(filePathParsed.dir, filePathParsed.name);
    const name = filePathParsed.name;

    // Skip upscaled images
    if(name.includes("upscaled"))
        return;

    // get relative path
    const relativePath = path.relative(settings.imageSettings.saveTo, filePath).replaceAll("\\", "/");
    const relativeImgPath = path.relative(settings.imageSettings.saveTo, `${basePath}.png`).replaceAll("\\", "/");

    // Image data
    const data = require(`../../${basePath}.json`);

    // Add relative and full json path
    data.dataPath = `/images/${relativePath}`;

    // Add relative and full png path
    data.imgPath = `/images/${relativeImgPath}`;

    // Add other data
    data.name = name;

    // Save into files
    files[name] = _.cloneDeep(data);

    // Get keywords, remove commas, split itno an array
    let keywords = _.cloneDeep(data.prompt);
    keywords = _.words(keywords);

    for(let i = 0; i < keywords.length; i++) {

        // Only store keywords greater than 1 character
        // Sometimes _.words() will split off a character into it's own array entry
        if(keywords[i].length <= 1)
            continue;

        // Deburr (Remove acent marks from letters)
        // Also make lowercase
        keywords[i] = _.deburr(keywords[i]);
        keywords[i] = _.lowerCase(keywords[i]);

        // Insert into index
        if(index[keywords[i]] == undefined)
            index[keywords[i]] = [];

        index[keywords[i]].push(name);
    }
}

// Rename legacy txt files to json
const buildIndexes = function(settings, directoryName) {

    // get files in a directory
    const dirFiles = fs.readdirSync(directoryName);

    // Loop through them
    dirFiles.forEach(function(file) {

        // Get full path
        const fullPath = path.join(directoryName, file);

        // Is it a folder or file?
        const f = fs.statSync(fullPath);

        // Loop through folder if it is one
        if (f.isDirectory()) {
            buildIndexes(settings, fullPath);
        } else {
            indexFile(settings, fullPath);
        }
    });
}

const query = function(keywords) {

    // Convert into words
    keywords = _.words(keywords);

    const keywordLookup = [];

    // Loop through
    for(let i = 0; i < keywords.length; i++) {

        // Sometimes _.words() will split off a character into it's own array entry
        if(keywords[i].length <= 1)
            continue;

        // Deburr (Remove acent marks from letters)
        // Also make lowercase
        keywords[i] = _.deburr(keywords[i]);
        keywords[i] = _.lowerCase(keywords[i]);

        // Get files associated with keyword
        const keywordFiles = index[keywords[i]];

        // If doesn't exist then end here
        if(keywordFiles == undefined)
            break;

        // Save files associated with keyword
        keywordLookup.push(keywordFiles);
    }

    let results = [];

    // If no results return empty array
    if(keywordLookup.length == 0)
        return results;

    // If 1 result, return file data associated with the result
    else if(keywordLookup.length == 1) {
        for(let i = 0; i < keywordLookup[0].length; i++) {
            results.push(files[keywordLookup[0][i]]);
        }

        return results;
    }

    // Figure out the files they have in common
    const resultFiles = _.intersection(...keywordLookup);

    // Stop here if no files
    if(resultFiles.length == 0)
        return results;

    // Convert array of filenames itno file data
    for(let i = 0; i < resultFiles.length; i++) {
        results.push(files[resultFiles[i]]);
    }

    // Send back
    return results;
}

const rebuildIndexes = function(settings) {
    console.log("Indexing images...");

    index = {};
    files = {};

    buildIndexes(settings, settings.imageSettings.saveTo);
}

module.exports = {
    getIndex() {return index},
    getFiles() {return files},
    rebuildIndexes,
    query,
}
