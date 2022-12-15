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

// If requested to make image variations of a file, this will load in the settings
// needed to make it happen. It is done before command line prompts to alow custom override
if(argv.fileVariations !== undefined)
	require("./src/loadVariationData")(
        argv.fileVariations,
        settings().settings,
        settings().imageSettings,
        settings().upscaleSettings);

// Use command line to override settings if any arguments are specified
require("./src/applyArgs")(
    argv,
    settings().settings,
    settings().imageSettings,
    settings().upscaleSettings);

// Upscale if requested, otherwise stop
if(argv.upscaleFile !== undefined)
	upscale(argv.upscaleFile)
else
	run();
