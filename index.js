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

// Load common code
const {
    argv,

    settings,

    genImage,
    upscale,
    run,
} = require("./common");

const _ = require("lodash");
const fs = require("fs");
const express = require('express');
const app = express();

const saveApng = require("./helpers/saveApng");
const saveResults = require("./helpers/saveResults");

const server = app.listen(settings().serverSettings.portProgress, async function() {

    let cmdLine = _.cloneDeep(process.argv);
    cmdLine.splice(0, 1);
    cmdLine.splice(0, 1);

    // Wrap commands in quotes if they are a string and have spaces
    for (let i = 0; i < cmdLine.length; i++) {
      const argument = cmdLine[i];

      // Ignore if not string
      if(typeof argument !== 'string')
        continue;

      // Seems it's a bit more complicated than just spaces, especially for powershell
      // If it starts with any character that isn't a letter or number, auto-enclose in quotes
      if(/[^a-z0-9\-.,]/gi.test(argument)) {
        cmdLine[i] = `"${argument}"`;
      }
    }

    settings().imageSettings.lastCmd = `node . ${cmdLine.join(" ")}`;

    // If requested to make image variations of a file, this will load in the settings
    // needed to make it happen. It is done before command line prompts to alow custom override
    if(argv.fileVariations !== undefined)
        require("./src/loadVariationData")(
            argv.fileVariations,
            settings().settings,
            settings().imageSettings,
            settings().upscaleSettings);

    // Re-rolling requires you to specify the filename and the field
    if(argv.rerollFile != undefined && argv.rerollField != undefined) {
        require("./src/loadRerollData")(
            argv.rerollFile,
            argv.rerollField,
            settings().settings,
            settings().imageSettings,
            settings().upscaleSettings);
    }

    // Extend an animation
    if(argv.extendAnimationFile != undefined) {
        require("./src/extendAnimation")(
            argv.extendAnimationFile,
            settings().settings,
            settings().imageSettings,
            settings().upscaleSettings);
    }

    // Convert to an animation
    else if(argv.toAnimationFile != undefined) {
        require("./src/toAnimation")(
            argv.toAnimationFile,
            settings().settings,
            settings().imageSettings,
            settings().upscaleSettings);
    }

    // Use command line to override settings if any arguments are specified
    require("./src/applyArgs")(
        argv,
        settings().settings,
        settings().imageSettings,
        settings().upscaleSettings,
        settings());

    // Upscale if requested, otherwise stop
    if(argv.upscaleFile !== undefined)
        await upscale(argv.upscaleFile)
    else
        await run();

    // Make APNG if animation frames exist
    // The cmd prompt is limited in that it doesn't have access to the image index
    // This means we can't gather existing image files, meaning if we save an animation, it will
    // only be for the newly generated images
    // Therefore, extending only adds new frames but to update the animiation, you need to use
    // the webui and regenerate it there
    if(settings().imageSettings.animationFrames != undefined && argv.extendAnimationFile == undefined)
        saveApng(settings().imageSettings.animationFrames, settings().imageSettings);

    // Write results file
    saveResults(settings().imageSettings);

    server.close();
});

app.get('/api/images/progress', async function(req, res) {
  res.jsonp({

    // Progress on-going or not
    progressOngoing: settings().imageSettings.progressOngoing,

    // Upscaling or not
    progressUpscaling: settings().imageSettings.progressUpscaling,

    // Image Progress
    progressCurStep: settings().imageSettings.progressCurStep,
    progressTotalSteps: settings().imageSettings.progressTotalSteps,

    // Image Batch Progress
    progressCurImg: settings().imageSettings.progressCurImg,
    progressTotalImg: settings().imageSettings.progressTotalImg,

    // Image Total Progress
    progressPercent: settings().imageSettings.progressPercent,
    progressEta: settings().imageSettings.progressEta,

    // Prompts Progress
    progressCurPrompt: settings().imageSettings.progressCurPrompt,
    progressTotalPrompts: settings().imageSettings.progressTotalPrompts,
  });
});
