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
const ice = require("./ice");
const color = require("./color");
const eerie = require("./eerie");
const wildlife = require("./wildlife");
const nature = require("./nature");
const mystical = require("./mystical");

module.exports = function() {
    // Start with base prompt
    let prompt = "";

    switch(_.random(0, 5, false)) {
        case 0:
            prompt += "ship, {ship-type}";
            break;

        case 1:
            prompt += "room, interrior, {room}";
            break;

        case 2:
            prompt += "house";
            break;

        case 3:
            prompt += "city, streetview, {city}";
            break;

        case 4:
            prompt += "building";
            break;

        case 5:
            prompt += "vehicle, {vehicle-type}";
            break;
    }

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", abandoned"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", ruins"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", rubble"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {mood} atmosphere"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", detailed"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", intricate"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {size} ";

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${color()}`;

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", dirty"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", grunge"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", rundown"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", broken"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", torn"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", graffiti"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", cracked"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", rusted"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", damaged"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", destroyed"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", mold"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", mildew"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", shattered glass"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", holes"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", clutter"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", messy"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", furniture"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", items"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", accesories"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", window"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {building-style}"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += ", {general-style}"

    if(_.random(0.0, 1.0, true) < 0.5)
        prompt += `, ${wildlife()}`

    if(_.random(0.0, 1.0, true) < 0.35)
        prompt += `, ${ice()}`;

    if(_.random(0.0, 1.0, true) < 0.35)
        prompt += `, ${eerie()}`;

    if(_.random(0.0, 1.0, true) < 0.25)
        prompt += `, ${mystical()}`;

    prompt += `${nature()}, ${weather()}`;

    return prompt;
}

module.exports.full = true;
