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
    _total: {count: 0, keywords: 0, files: 0, highestKeyword: "", highestKeywordCount: 0}
};

const progressVal = {
    value: null,
    total: null
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
    const data = JSON.parse(fs.readFileSync(`./${basePath}.json`).toString());

    // Add relative and full json path
    data.dataPath = `/images/${relativePath}`;
    data.dataPathReal = relativePath;

    // Add relative and full png path
    data.imgPath = `/images/${relativeImgPath}`;
    data.imgPathReal = relativeImgPath;

    // Add other data
    data.name = name;

    // Deep link original to this upscale
    // Since we don't index upscales, we store only the image path
    if(data.upscaleOf)
        deepLink(data.upscaleOf.toString(), data.imgPath, "upscales");

    // Don't link upscaled re-rolls
    if(data.rerollOf && !data.upscaleOf)
        deepLink(data.rerollOf.toString(), {
            name,
            imgPath: data.imgPath,
        }, "rerolls");

    // Deep link original to this variation
    // There was apparently a bug that made variationOf names numbers, this ensures their
    // properly sent as a string
    if(data.variationOf && !data.upscaleOf)
        deepLink(data.variationOf.toString(), {
            name,
            imgPath: data.imgPath,
        }, "variations");

    if(data.animationFrameOf)
        deepLink(data.animationFrameOf.toString(), {
            name,
            imgPath: data.imgPath,
        }, "animationFrames");

    if(data.animationOf)
        deepLink(data.animationOf.toString(), {
            name,
            imgPath: data.imgPath,
        }, "animations");

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

        // Save high-score winner
        if(indexStats[keywords[i]].count > indexStats._total.highestKeywordCount) {
            indexStats._total.highestKeyword = keywords[i];
            indexStats._total.highestKeywordCount = indexStats[keywords[i]].count;
        }

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
    progressVal.total = dirFiles.length;

    for(let i = 0; i < dirFiles.length; i++) {

        // Update progress bar
        progressBar.update(i);
        progressVal.value = i;

        // Get file
        const file = dirFiles[i];

        // Get full path
        const fullPath = path.join(directoryName, file);

        // Is it a folder or file?
        const f = fs.statSync(fullPath);

        // UPDATE: No more recursive directory, root output folder only
        // Loop through folder if it is one
        if (f.isDirectory()) {
            // buildIndexes(settings, fullPath);
            // progressBar.setTotal(dirFiles.length);
            // progressBar.update(i);
            // progressVal.total = dirFiles.length;
            // progressVal.value = i;
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

let indexingHasChanged = false;
let orphanedfiles = [];

// Remove deep link from file
const removeDeepLink = function(settings, fileName, oneToOneName) {
    orphanedfiles.push(`${fileName}...`);

    // Minimally touch the file
    const data = JSON.parse(fs.readFileSync(`${settings.imageSettings.saveTo}/${fileName}.json`).toString());
    delete data[oneToOneName];
    fs.writeFileSync(`${settings.imageSettings.saveTo}/${fileName}.json`, JSON.stringify(data, null, 4));

    // Announce inde has changed and needs to be re-indexed
    indexingHasChanged = true;
}

const validateDeepLink = function(settings, fileName, oneToOneName) {

    // Remove variation to file if no such file exists in index or is
    // invalid
    if(files[fileName][oneToOneName] != undefined) {
        const oneToOne = files[fileName][oneToOneName];
        if(files[oneToOne] == undefined ||
            files[oneToOne].imgPath == undefined) {

            delete files[fileName][oneToOneName];

            // Also remove it from the file itself
            removeDeepLink(settings, fileName, oneToOneName);
        }
    }
}

// Upscales have to be handled specially since their usually not linked
// more, just referenced. They have to be orphaned more specially
// We have to convert an upscale reference to a full normal index entry without a parent
const validateUpscaleDeepLink = function(settings, fileName) {
    const data = files[fileName];

    // Stop here if no upscales
    if(data.upscales == undefined)
        return;

    // Go through upscales
    for(let i = 0; i < data.upscales.length; i++) {

        // Get upscale path
        // /images/12457-upscaled.png
        const upscalePath = data.upscales[i];

        // Convert it to a name
        // [/images/12457-upscaled.png, 12457-upscaled]
        let upscaleName = upscalePath.match(/^.*\/(.*)\..*/m);

        // we have to have an array with the full path and name, 2 elements
        // [/images/12457-upscaled.png, 12457-upscaled]
        if(upscaleName.length < 2) {
            console.error(`Attempt to orphan upscale ${upscalePath} failed, needed 2 elements, got 1`);
            console.error(upscaleName);
            continue;
        }

        // Keep only the name part
        // 12457-upscaled
        upscaleName = upscaleName[1];

        // Get the path without upscaled
        // 12457-upscaled
        let upscaleNewName = upscaleName.match(/^(.*)-.*/m);

        // we have to have an array with the normal name and new name, 2 elements
        // [12457-upscaled, 12457]
        if(upscaleNewName.length < 2) {
            console.error(`Attempt to orphan upscale ${upscalePath} failed, needed 2 elements, got 1`);
            console.error(upscaleNewName);
            continue;
        }

        // 12457
        upscaleNewName = upscaleNewName[1];

        // Rename the file
        try {
            // /output/12457-upscaled.png => /output/12457.png
            fs.renameSync(
                `${settings.imageSettings.saveTo}/${upscaleName}.png`,
                `${settings.imageSettings.saveTo}/${upscaleNewName}.png`
            );

            // /output/12457-upscaled.json => /output/12457.json
            fs.renameSync(
                `${settings.imageSettings.saveTo}/${upscaleName}.json`,
                `${settings.imageSettings.saveTo}/${upscaleNewName}.json`
            );
        }
        catch(err) {
            console.error(`Unable to orphan and rename ${upscaleName}`);
            console.error(err);
            continue;
        }

        // Remove the upscaleOf aspect of the file finally getting to the part
        // where we orphan it
        removeDeepLink(settings, upscaleNewName, "upscaleOf");
    }
}

// Ensures indexes are valid
// Such as file placeholders with no file data
// deep links that point to non-existent files
const validateIndexes = function(settings) {

    // Get indexed files
    const fileNames = _.keys(files);

    // Set progress total
    progressBar.setTotal(fileNames.length);
    progressVal.total = fileNames.length;

    // Go through each file
    for(let i = 0; i < fileNames.length; i++) {

        // Update progress bar
        progressBar.update(i);
        progressVal.value = i;

        // Get filename
        const fileName = fileNames[i];

        // Delete filename if it points to non-existent data
        if(files[fileName] == undefined) {
            delete files[fileName];
            continue;
        }

        // Delete if there's no stored image path
        if(files[fileName].imgPath == undefined) {
            validateUpscaleDeepLink(settings, fileName);
            delete files[fileName];
            continue;
        }

        // Remove deep links that go to nowhere
        validateDeepLink(settings, fileName, "variationOf");
        validateDeepLink(settings, fileName, "upscaleOf");
        validateDeepLink(settings, fileName, "rerollOf");
        validateDeepLink(settings, fileName, "animationFrameOf");
        validateDeepLink(settings, fileName, "animationOf");
    }
}

// Does final steps that can only be done after all is said and done
const postBuildIndexes = function() {

    // Get indexed files
    const fileNames = _.keys(files);

    // Go through each file
    for(let i = 0; i < fileNames.length; i++) {

        // Get filename
        const fileName = fileNames[i];

        // Get file data
        const file = files[fileName];

        // Stop if has no animations
        if(file.animationFrames == undefined)
            continue;

        // Initial value of invalid
        let highestFrameCount = -1;

        // Get highest frame count
        for(let j = 0; j < file.animationFrames.length; j++) {

            // Get animation frame file name
            const animationFrameFileName = file.animationFrames[j].name;

            // Get animation frame file
            const animationFrameFile = files[animationFrameFileName];

            // Skip if file isn't present for some reason
            if(animationFrameFile == undefined)
                continue;

            // Skip if frame isn't listed for some reason
            if(animationFrameFile.animatonFrameNumber == undefined)
                continue;

            // Compare
            if((+animationFrameFile.animatonFrameNumber) > highestFrameCount)
                highestFrameCount = (+animationFrameFile.animatonFrameNumber);
        }

        // Save highest frame number
        if(highestFrameCount > -1)
            file.highestFrameCount = +highestFrameCount;
    }
}

const rebuildIndexes = function(settings) {
    console.log("Indexing images...");

    let count = 0;

    do {
        indexingHasChanged = false;
        orphanedfiles = [];

        progressBar.start(0 ,0);
        progressVal.value = 0;
        progressVal.total = 0;

        index = {};
        files = {};
        indexStats = {
            _total: {count: 0, keywords: 0, files: 0, highestKeyword: "", highestKeywordCount: 0}
        };

        buildIndexes(settings, settings.imageSettings.saveTo);
        validateIndexes(settings);
        postBuildIndexes();

        progressBar.stop();
        progressVal.value = null;
        progressVal.total = null;

        if(indexingHasChanged) {
            console.log("");
            console.log("These files have been orphaned because of a removed parent, we need to re-index...");
            console.log(orphanedfiles.join("\n"));
            console.log("");
            console.log("Re-indexing...");
        }

        count++;
        if(count >= 5)
            break;
    } while(indexingHasChanged);

    if(count == 5) {
        console.error("Encountered an infinite re-index loop, had to stop...");
    }
}

module.exports = {
    getIndex() {return index},
    getFiles() {return files},
    getIndexStats() {return indexStats},
    getProgress() {return progressVal},
    rebuildIndexes,
    query,
}
