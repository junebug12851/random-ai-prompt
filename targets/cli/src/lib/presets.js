/**
 * @file
 * @brief Preset loading for the CLI — a thin re-export of the shared engine-owned preset module
 * (`engine/presets.js`), so the CLI and the local backend's `/api/prompt` share one copy of the preset
 * rules (built-in `engine/data/presets/` + `user/presets/` overlay, later layers win).
 */
export {
  presetNames,
  loadPreset,
  resolvePresets,
  applyPreset,
} from "../../../../engine/presets.js";
