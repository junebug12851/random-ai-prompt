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
const weather = require("./weather");
const water = require("./water");
const nature = require("./nature");
const wildlife = require("./wildlife");
const eerie = require("./eerie");
const ice = require("./ice");
const mystical = require("./mystical");
const lava = require("./lava");
const crystal = require("./crystal");
const color = require("./color");

function additionalMystical() {
    let prompt = "";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", glow";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", bioluminescent";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${color()} crystal`

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${color()} gemstone`

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {color}";

    return prompt;
}

function settlement() {
    let prompt = "";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", house"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", village"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", path"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", worn down";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", weathered";

    return prompt;
}

module.exports = function() {

    // Start with base prompt
    let prompt = "mountain";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", fog"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", rock"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", stone"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", mountainous horizon"

    if(_.random(0.0, 1.0, true) < 0.25) {
        switch(_.random(0, 2, false)) {
            case 0:
                prompt += `, volcano, ${lava()}`;
                break;
            case 1:
                prompt += `, winter, snow mountain, ${ice()}`;
                break;
            case 2:
                prompt += `, crystal mountain, ${crystal()}`;
                break;
        }
    }

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += `, ${additionalMystical()}`

    if(_.random(0.0, 1.0, true) < 0.3)
        prompt += `, ${settlement()}`

    if(_.random(0.0, 1.0, true) < 0.25)
        prompt += `, ${eerie()}`

    if(_.random(0.0, 1.0, true) < 0.35)
        prompt += `, ${ice()}`

    if(_.random(0.0, 1.0, true) < 0.2)
        prompt += `, ${mystical()}`

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${wildlife()}`

    if(_.random(0.0, 1.0, true) < 0.25)
        prompt += `, ${water()}`

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${nature()}`

    prompt += `, ${weather()}`;

    return prompt;
}

module.exports.full = true;
