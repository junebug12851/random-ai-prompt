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

const fs = require("fs");

function userSettings() {
    // Check for existence of user-settings.js
    try {
        fs.accessSync('./user-settings.json');
        return;
    } catch (err) {}

    console.log("Missing user-settings.json, creating for you...");

    // Does not exist, create
    const file = fs.readFileSync('./default-user-settings.json').toString();
    fs.writeFileSync('./user-settings.json', file);
}

module.exports = function() {

    // Ensure user settings exists
    userSettings();

    // Done
}
