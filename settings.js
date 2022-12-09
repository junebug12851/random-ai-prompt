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

/////////////////////////////////////
/// DONT ADJUST SETTINGS HERE
/// ADJUST SETTINGS IN user-settings.js
/////////////////////////////////////

// All of these can be overridden with command-line arguments

// Use --presets "preset1, preset2, etc..." to use presets, they will be executed in order.
// Presets pre-configure settings files but command-line arguments always have
// the final say

module.exports = {

	// Default number of keywords to generate
	/*--count <number>*/
	keywordCount: 5,

	// Max keywords for randomness, set to same value to have no randomness
	/*--max-count <number>*/
	keywordMaxCount: 7,

	// Number of prompts to generate
	/*--prompts <number>*/
	promptCount: 1,

	// Whether to generate images for you based on the generated prompts
	// Uses the settings in imageSettings.js
	/*--generate-images <true/false>*/
	generateImages: false,

	// Whether to upscale generated images for you based on the generated prompts
	// Uses the settings in upscaleSettings.js
	/*--upscale-images <true/false>*/
	upscaleImages: false,

	// hides the prompt from being shown, useful for rendering images and not
	// wanting to additioanlly print the prompt
	/*--hide-prompt <true/false>*/
	hidePrompt: false,

	// Whether to randomly emphasize or de-emphasize keywords
	/*--emphasis <true/false>*/
	keywordEmphasis: true,

	// For each keyword, the chance it will be emphasized or de-emphasized
	/*--emphasis-chance <0.0-1.0>*/
	emphasisChance: 0.20,

	// Upon being selected for emphasis/de-emphasis, the chance on each level
	// that it will aquire an additional level of emphasis/de-emphasis
	/*--emphasis-level-chance <0.0-1.0>*/
	emphasisLevelChance: 0.20,

	// Max levels of empasis/de-emphasis
	/*--emphasis-max-levels <number>*/
	emphasisMaxLevels: 5,

	// Upon being selected for emphasis/de-emphasis, chance it will be de-emphasis over emphasis
	/*--de-emphasis-chance <0.0-1.0>*/
	deEmphasisChance: 0.25,

	// Whether to randomly ask stable diffusion to add-in, swap-out, or remove
	// certain keywords mid-generation
	/*--editing <true/false>*/
	keywordEditing: true,

	// Minimum steps or percent for editing
	/*--editing-min <number or 0.0-1.0>*/
	keywordEditingMin: 2,

	// Maximum steps or percent for editing
	/*--editing-max <number or 0.0-1.0>*/
	keywordEditingMax: 4,

	// Whether to randomly ask stable diffusion to alternate random keywords
	// thus creating hybrid effects from both keywords
	/*--alternating <true/false>*/
	keywordAlternating: true,

	// Max levels of keyword alternating
	/*--alternating-max-levels <number>*/
	keywordAlternatingMaxLevels: 2,

	// Whether to additioanlly add in artist keywords
	/*--use-artists <true/false>*/
	includeArtist: true,

	// Minimum artists to add in
	/*--min-artists <number>*/
	minArtist: 0,

	// Maximum artist to add in
	/*--max-artists <number>*/
	maxArtist: 3,

	// When specifying lists in the prompts, it searches this folder for them
	// A list is a file with an entry on each line, one will randomly be selected if used in a prompt
	// To use a list, use {filename}, {keyword}, {artist}, {flower}
	/*--list-files <path>*/
	listFiles: "./lists",

	// When specifyuing multiple prompts, reload lists on each new prompt
	// When a word is pulled from a list randomly, it's not available again until the list depletes
	// This makes every list word guaenteed to be unique
	// If this is disabled, then when specifying multiple prompts, every prompt in the batch will have unique keywords
	/*--reload-lists <true/false>*/
	reloadListsOnPromptChange: true,

	// Allows list entries to potentially apear more than once
	/*--list-entries-once <true/false>*/
	listEntriesUsedOnce: true,

	// Path to the artists file (Each artist on a seperate line)
	// If false, then don't use an artist file, have it be completely random (excluding keyword dictionaries)
	/*--artist-filename <name>*/
	/*--artists <name>*/
	artistFilename: "artist",

	// Path to the keywords file (Each keyword on a seperate line)
	// If false, then don't use a keywords file, have it be completely random (excluding artist dictionaries)
	/*--keywords-filename <name>*/
	/*--dict <name>*/
	/*--keywords <name>*/
	keywordsFilename: "keyword",

	// When specifying expansions in the prompts, it searches this folder for them
	// An expansion is a keyword which expands out to the contents of a file
	// Expansions can expand out to list files which can expand out to random words
	// To use an expansion, use <filename>
	/*--expansion-files <path>*/
	expansionFiles: "./expansions",

	// When specifying presets in the command, it searches this folder for them
	// Presets override settings however command-line arguments always override last
	/*--preset-files <path>*/
	presetFiles: "presets",

	// When specifying dynamic prompts in the command, it searches this folder for them
	// Dynamic prompts is code that dynamically generates a prompt on each run
	// The regular prompt is always executed first followed by each dynamic prompt in-order
	// Each time the prompt is handed to the next dynamic prompt
	/*--dynamic-prompt-files <path>*/
	dynamicPromptFiles: "dynamic-prompts",

	// They will be executed in order and will repeat execution on each prompt change
	// They should be in array form, only use the comma seperated version for command-line arguments
	// There are 2 commands, one adds to the start of the list, the other replaces the list
	// This makes it easy to add in dynamic prompts witout worry of specifying existing core ones
	/*--dyn-prompts <comma-seperated dynamic prompts>*/
	/*--all-dyn-prompts <comma-seperated dynamic prompts>*/
	dynamicPrompts: ["_promptPrefix", "_expansion", "_prompt-salt", "_prompt", "_prompt-danbooru", "_list"],

	// Auto-add a random number to the end of every prompt, useful as an alternative
	// to subseeds, suggested by reddit
	/*--prompt-salt <true/false>*/
	promptSalt: false,

	// Make the salt incremental instead of random, if so, this is the starting value
	// -1 means keep it at random
	/*--prompt-salt-start <number>*/
	promptSaltStart: -1,

	// The prompt to use
    // {prompt} is replaced with random prompt generated here
    // {keyword} is replaced with the selected keywords list file
    // {artist} is replaced with the selected artist list file
    // You can alternatively use {keyword} or {artist} or any other file in 
    // ./data for a single random element from that file
    /*--prompt <prompt>*/
    prompt: "{prompt}",

    // Prefixes this to the start of the prompt upon reaching the start of the
    // core dynamic prompts
    /*--prompt-prefix <prompt>*/
    promptPrefix: "",
}
