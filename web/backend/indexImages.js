const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const nlp = require("compromise");
const cliProgress = require('cli-progress');

const progressBar = new cliProgress.SingleBar({
    barCompleteChar: '\u2588',
    barIncompleteChar: ' ',
    hideCursor: true,
    clearOnComplete: true,
    fps: 30,
    format: '[' + '{bar}' + '] {percentage}% [{value}/{total}] {duration_formatted}',
});

// Memory index
// key = keyword: value = array of image file names
let index = {};

// key = baseFilename, value = json + relative path to file
let files = {};

// Index Stats
// key = keyword: value = object showing keyword count
// Special keyword for _total showing total keywords and total keyword count
let indexStats = {
    _total: {count: 0, keywords: 0, files: 0}
};

function nlpProcess(word) {
    let ret = nlp(word).nouns().toSingular().text();

    if(ret.length <= 1)
        ret = word;
    else
        return ret;

    ret = nlp(word).verbs().toInfinitive().text();

    if(ret.length <= 1)
        ret = word;
    else
        return ret;

    return word;
}

function toKeywords(prompt) {

    // Make lowercase
    prompt = _.toLower(prompt);

    // Extract keywords, extract by word boundry and letter boundry
    // This will produce stuff like 1girl => 1girl, girl
    prompt = [..._.words(prompt, /[\w]+/g), ..._.words(prompt)];

    // Remove duplicate keywords
    prompt = _.uniq(prompt);

    // Operate on individual keywords
    let promptTmp = [];
    for(let i = 0; i < prompt.length; i++) {

        // Trim whitespace
        let promptWord = prompt[i].trim();

        // Skip over any keywords 1 character or less
        if(promptWord.length <= 1)
            continue;

        // If it consist of only digits, then skip over
        if(/^\d+$/gm.test(promptWord))
            continue;

        // Opted out of, far too slow even if it provides good results

        // Process word with nlp
        // let nlpTmp = nlpProcess(promptWord);

        // Save only if different from prompt word and more than 1 character
        // if(nlpTmp.length > 1 && nlpTmp != promptWord)
        //     promptTmp.push(nlpTmp);

        // Save prompt word
        promptTmp.push(promptWord);
    }

    // Save back to prompt
    prompt = promptTmp;

    // Remove duplicate keywords again
    prompt = _.uniq(prompt);

    // Sort
    prompt = _.sortBy(prompt);

    // Send back
    return prompt;
}

function toComparitiveKeywords(prompt) {
    // Make lowercase
    prompt = _.toLower(prompt);

    // Convert to words by word boundrary only
    // This gives the user freedom to specify girl or 1girl
    prompt = _.words(prompt, /[\w]+/g);

    // Remove duplicate keywords
    prompt = _.uniq(prompt);

    // Operate on individual keywords
    let promptTmp = [];
    for(let i = 0; i < prompt.length; i++) {

        // Trim whitespace
        let promptWord = prompt[i].trim();

        // Skip over any keywords 1 character or less
        if(promptWord.length <= 1)
            continue;

        // Save prompt word
        promptTmp.push(promptWord);
    }

    // Save back to prompt
    prompt = promptTmp;

    // Remove duplicate keywords again
    prompt = _.uniq(prompt);

    // Send back
    return prompt;
}

const deepLink = function(fromName, toName, linkType) {

    // Create file placeholder if it doesn't exist
    if(files[fromName] == undefined)
        files[fromName] = {};

    // Create linkType array if it doesn't exist
    if(files[fromName][linkType] == undefined)
        files[fromName][linkType] = [];

    // Perform link
    files[fromName][linkType].push(toName);
}

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

    // Deep link original to this upscale
    // Since we don't index upscales, we store only the image path
    if(data.upscaleOf)
        deepLink(data.upscaleOf.toString(), data.imgPath, "upscales");

    // Deep link original to this variation
    // There was apparently a bug that made variationOf names numbers, this ensures their
    // properly sent as a string
    if(data.variationOf)
        deepLink(data.variationOf.toString(), name, "variations");

    // We don't index upscales but we attach the upscale to the original
    if(name.includes("upscaled"))
        return;

    // Increment file count
    indexStats._total.files++;

    // Save into files
    // Sometimes deep linking will create a file placeholder, don't replace if so
    if(files[name] == undefined)
        files[name] = _.cloneDeep(data);
    else
        _.merge(files[name], _.cloneDeep(data));

    // Get prompt
    let keywords = _.cloneDeep(data.prompt);

    // Add in original prompt if there is one
    if(data.origPrompt)
        keywords = `${keywords}, ${data.origPrompt}`

    // Convert to keywords
    keywords = toKeywords(keywords);

    // Save Keywords
    files[name].keywords = _.cloneDeep(keywords);

    // Index
    for(let i = 0; i < keywords.length; i++) {

        // Add to stats

        // Create keyword if it doesn't exist and increment keyword count
        if(indexStats[keywords[i]] == undefined) {
            indexStats._total.keywords++;
            indexStats[keywords[i]] = {count: 0};
        }

        // Increment keyword usage count and total usage count
        indexStats[keywords[i]].count++;
        indexStats._total.count++;

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

    // Set progress total
    progressBar.setTotal(dirFiles.length);

    for(let i = 0; i < dirFiles.length; i++) {

        // Update progress bar
        progressBar.update(i);

        // Get file
        const file = dirFiles[i];

        // Get full path
        const fullPath = path.join(directoryName, file);

        // Is it a folder or file?
        const f = fs.statSync(fullPath);

        // Loop through folder if it is one
        if (f.isDirectory()) {
            buildIndexes(settings, fullPath);
            progressBar.setTotal(dirFiles.length);
            progressBar.update(i);
        } else {
            indexFile(settings, fullPath);
        }
    }
}

const query = function(keywords) {

    // Convert into keywords built for comparing against index
    keywords = toComparitiveKeywords(keywords);

    const keywordLookup = [];

    // Loop through
    for(let i = 0; i < keywords.length; i++) {

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

        // Filter duplicates that refer to the same image
        return _.shuffle(_.uniqBy(results, "imgPath"));
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

    // Filter duplicates that refer to the same image
    return _.shuffle(_.uniqBy(results, "imgPath"));
}

// Ensures indexes are valid
// Such as file placeholders with no file data
// deep links that point to non-existent files
const validateIndexes = function() {

    // Get indexed files
    const fileNames = _.keys(files);

    // Set progress total
    progressBar.setTotal(fileNames.length);

    // Go through each file
    for(let i = 0; i < fileNames.length; i++) {

        // Update progress bar
        progressBar.update(i);

        // Get filename
        const fileName = files[i];

        // Delete filename if it points to non-existent data
        if(files[fileName] == undefined) {
            delete files[fileName];
            continue;
        }

        // Delete if there's no stored image path
        if(files[fileName].imgPath == undefined) {
            delete files[fileName];
            continue;
        }

        // Remove variation to file if no such file exists in index or is
        // invalid
        if(files[fileName].variationOf != undefined) {
            const variationOf = files[fileName].variationOf;
            if(files[variationOf] == undefined ||
                files[variationName].imgPath == undefined)
                delete files[fileName].variationOf;
        }

        // Remove variations to file if they don't exist
        if(files[fileName].variations != undefined) {

            // Valid variations
            const validVariations = [];

            // Go through each variation
            for(let j = 0; j < files[fileName].variations.length; j++) {

                // Get name
                const variationName = files[fileName].variations[j];

                // Check to see if it exists and is valid
                if(files[variationName] != undefined &&
                    files[variationName].imgPath != undefined)
                    validVariations.push(variationName);
            }

            // Re-save proper list of variations
            files[fileName].variations = validVariations;

            // Remove entirely if all variations are invalid
            if(files[fileName].variations.length == 0)
                delete files[fileName].variations;
        }
    }
}

const rebuildIndexes = function(settings) {
    console.log("Indexing images...");

    progressBar.start(0 ,0);

    index = {};
    files = {};
    indexStats = {
        _total: {count: 0, keywords: 0, files: 0}
    };

    buildIndexes(settings, settings.imageSettings.saveTo);
    validateIndexes();

    progressBar.stop();
}

module.exports = {
    getIndex() {return index},
    getFiles() {return files},
    getIndexStats() {return indexStats},
    rebuildIndexes,
    query,
}
