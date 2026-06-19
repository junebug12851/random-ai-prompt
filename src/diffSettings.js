/**
 * @file
 * @brief Computes the diff between the live settings and the defaults; this is what userSettings() persists.
 */

import _ from "lodash";

/**
 * Copy the keys of one settings group that differ from the defaults into `diff`.
 * @param {object} settings The live settings.
 * @param {object} defSettings The default settings.
 * @param {string} groupName The group ("settings", "imageSettings", …).
 * @param {object} diff The accumulating diff object (mutated).
 * @returns {void}
 */
function processGroup(settings, defSettings, groupName, diff) {
  if (settings[groupName] == undefined) return;

  _.forEach(settings[groupName], (value, key) => {
    const curSetting = settings[groupName][key];
    const defSetting = defSettings[groupName][key];

    if (!_.isEqual(curSetting, defSetting)) {
      diff[groupName][key] = curSetting;
    }
  });
}

/**
 * Compute the per-group diff between live settings and defaults — the subset that
 * `userSettings()` persists to `user-settings.json`.
 * @param {object} settings The live settings.
 * @param {object} defSettings The default settings.
 * @returns {object} The grouped diff (`{settings, imageSettings, upscaleSettings, serverSettings}`).
 */
export default function (settings, defSettings) {
  const diff = {
    settings: {},
    imageSettings: {},
    upscaleSettings: {},
    serverSettings: {},
  };

  processGroup(settings, defSettings, "settings", diff);
  processGroup(settings, defSettings, "imageSettings", diff);
  processGroup(settings, defSettings, "upscaleSettings", diff);
  processGroup(settings, defSettings, "serverSettings", diff);

  return diff;
}
