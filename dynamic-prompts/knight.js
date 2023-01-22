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

const _ = require("lodash");

module.exports = function(settings) {

    // Disable auto fx and artists
    settings.autoAddArtists = false;
    settings.autoAddFx = false;

	// Start with base prompt
	let prompt = `knight, warrior`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", helmet";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", nordic armor";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", holding a sword";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", fullbody";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", front-shot";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", rpg portrait";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", closeup";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", detailed face";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", detailed body";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", highly detailed";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", intricate detailed";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", hyperrealistic";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", #mystical";

    prompt += `, #landscape`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", [[castle]]";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", #general-state";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", victorian";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", illustration";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", character design";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", concept art";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", unreal engine 5";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", daz";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", octane render";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", dynamic lighting";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", vibrancy";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", cinematic";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", cinematic lighting";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", global illumination";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", ray tracing";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", hdr";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", digital art";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", <dap>";

	return prompt;
}

module.exports.full = true;
