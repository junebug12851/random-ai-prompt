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

// Load settings
const settings = require("./settings");
const imageSettings = require("./image-settings");
const upscaleSettings = require("./upscale-settings");

/////////////////////////////////////
/// Adjust settings here
/////////////////////////////////////

// Example adjustments, be sure to go through the settings files and change any
// settings here

settings.keywordCount = 5;

imageSettings.cfg = 11.0;

upscaleSettings.saveBeforeUpscale = true;

/////////////////////////////////////
/////////////////////////////////////

module.exports = {
	settings,
	imageSettings,
	upscaleSettings
}
