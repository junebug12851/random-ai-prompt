const _ = require("lodash");

function processGroup(settings, defSettings, groupName, diff) {

	if(settings[groupName] == undefined)
		return;

	_.forEach(settings[groupName], (value, key) => {
		const curSetting = settings[groupName][key];
		const defSetting = defSettings[groupName][key];

		if(!_.isEqual(curSetting, defSetting)) {
			diff[groupName][key] = curSetting;
		}
	});
}

module.exports = function(settings, defSettings) {
	const diff = {
		settings: {},
		imageSettings: {},
		upscaleSettings: {},
		serverSettings: {}
	};

	processGroup(settings, defSettings, "settings", diff);
	processGroup(settings, defSettings, "imageSettings", diff);
	processGroup(settings, defSettings, "upscaleSettings", diff);
	processGroup(settings, defSettings, "serverSettings", diff);

	return diff;
}
