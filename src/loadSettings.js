const fs = require('fs');
const _ = require("lodash");

// Enviroment
const env = process.env;

const isServer = (process.env.server != undefined);

// Ensure user-settings is created
require("./createMissingUserSettings")();

// Import settings differ
const diffSettings = require("./diffSettings");

// Load settings
const basicSettings = require("../settings");
const imageSettings = require("../image-settings");
const upscaleSettings = require("../upscale-settings");
const serverSettings = require("../server-settings");

// Add whether we're runing inside a server or not
basicSettings.isServer = isServer;

// Combine them into a single object
// We use deep-clone to prevent the mfrom being modified
// This also prevents a bug where converting legacy settings which modifies these files
// therefore also modies this copy
const defSettings = _.cloneDeep({
    settings: basicSettings,
    imageSettings,
    upscaleSettings,
    serverSettings,
});

let settings;

// Does a complicated process of reloading settings
function reloadSettings() {

	// Load "user-settings.json"
	let userSettings = JSON.parse(fs.readFileSync("./user-settings.json").toString());

	// Clone default settings as a basis
    settings = _.cloneDeep(defSettings);

    // Merge user settings into main settings
	if(userSettings.settings != undefined)
	    _.merge(settings.settings, userSettings.settings);

	if(userSettings.imageSettings != undefined)
	    _.merge(settings.imageSettings, userSettings.imageSettings);

	if(userSettings.upscaleSettings != undefined)
	    _.merge(settings.upscaleSettings, userSettings.upscaleSettings);

	if(userSettings.serverSettings != undefined)
	    _.merge(settings.serverSettings, userSettings.serverSettings);

	// Merge legacy user-settings.js if it exists
	try {
	    // Import legacy settings
	    const legacySettings = require("../user-settings.js");

	    console.log("Found old user-settings.js, converting to user-settings.json...");

	    // Do a diff on it to extract the actual changes
	    const legacyDiff = diffSettings(legacySettings, defSettings);

	    // Merge changes in
	    _.merge(settings, legacyDiff);

	    // Remove legacy file
	    fs.unlinkSync("./user-settings.js");
	}
	catch(err) {}
}

// Do initial settings load now
reloadSettings();

// Allows obtaining the user dettings that differ from the main settings
function userSettings() {

	// Get diff between default and user settings
	const ret = diffSettings(settings, defSettings);

	// Remove these internal only settings
	delete ret.settings.origPrompt;
	delete ret.settings.randomPrompt;
	delete ret.settings.ignoreFirstAutoArtistPass;

	delete ret.imageSettings.lastCmd;
	delete ret.imageSettings.variationOf;
	delete ret.imageSettings.origPostPrompt;
	delete ret.imageSettings.autoIncludedFx;
	delete ret.imageSettings.autoIncludedArtists;

	delete imageSettings.resultPrompts;
	delete imageSettings.resultImages;

	delete imageSettings.progressOngoing;
	delete imageSettings.progressPercent;
	delete imageSettings.progressEta;
	delete imageSettings.progressCurImg;
	delete imageSettings.progressTotalImg;
	delete imageSettings.progressCurStep;
	delete imageSettings.progressTotalSteps;
	delete imageSettings.progressCurPrompt;
	delete imageSettings.progressTotalPrompts;

	// Return
	return ret;
}

// Save User Settings
function saveSettings() {
    // Save user settings as user-settings.json
    fs.writeFileSync("./user-settings.json", JSON.stringify(userSettings(), null, 4));
}

// Do initial save now
saveSettings();

module.exports = {
	// Settings (Use function to get up-to-date settings)
	settings() {return settings},

	userSettings,

	// Default settings (Debug, use deep clone to prevent tampering)
	defSettings() {return _.cloneDeep(defSettings)},

	// Replace Settings
	replaceSettings(newSettings) {settings = newSettings},

	reloadSettings,
	saveSettings,
};
