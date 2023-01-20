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

function maybeGlow() {
    if(_.random(0.0, 1.0, true) < 0.5)
        return "#glow";
    else
        return "#color";
}

// rabbit in Egyptian clothing style, highly detailed, digital painting, arts station, concept art, soft, sharp focus, illustration, art by artgerm and greg rutkowski and alphonse mucha
module.exports = function(settings) {

    // This will not work well with added artists or fx
    // settings.autoAddArtists = false;
    // settings.autoAddFx = false;

    let prompt = `{animal}, furry`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, #mystical`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {emotion}"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, in {general-style} clothing style`

    const clothingCount = (_.random(0.0, 1.0, true) < 0.5) ? _.random(0, 5, false) : 0;

    for(let i = 0; i < clothingCount; i++) {
        prompt += `, ${maybeGlow()} {clothes}`;
    }

    if(_.random(0.0, 1.0, true) < 0.1)
        prompt += ", {instrument}"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, #weather`;

    return prompt;
}

module.exports.full = true;
