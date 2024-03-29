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

// This was taken from publicprompts.art and modified to be more dynamic

// Tiny cute isometric <name> in a cutaway box, soft smooth lighting, soft colors, <name> color scheme, soft colors, 100mm lens, 3d blender render
module.exports = function(settings) {

    // This will not work well with added artists or fx
    settings.autoAddArtists = false;
    settings.autoAddFx = false;

	// Start with base prompt
	return "Tiny cute isometric #room in a cutaway box, soft smooth lighting, soft colors, {color} color scheme, soft colors, 100mm lens, 3d blender render";
}

module.exports.full = true;
