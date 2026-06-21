/**
 * @file
 * @brief JS sidecar for futuristic.dpl — stateful dedup logic (flags prevent doubled weather/animal/etc).
 *        Invoked via `script: futuristic.js`. See notes/reference/dpl-design.md (the JS bridge).
 */

import _ from "lodash";

// Tracks which sub-prompts were already added, so we don't double them up.
let data = {};

/**
 * Generate the futuristic scene (ported from v2 scene/futuristic.js).
 * @param {object} ctx The DPL bridge context (settings, rng, section/prompt/list/expand).
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  data = {};
  let prompt = "futuristic";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", metal";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", bolt";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", high-tech";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", cyberpunk";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", ancient";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", ({#glow})";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", ({#neon})";
  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", night";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", fog";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", mecha";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", {#crystal}";

  if (_.random(0.0, 1.0, true) < 0.35) {
    prompt += ", {#portrait-person}";
    if (_.random(0.0, 1.0, true) < 0.5) prompt += ", solo";
    data.weather = true;
    data.animal = true;
    // eslint-disable-next-line no-dupe-else-if -- each _.random() re-rolls; not a real duplicate
  } else if (_.random(0.0, 1.0, true) < 0.35) {
    prompt += ", {#portrait-animal}";
    data.weather = true;
  }

  if (_.random(0.0, 1.0, true) < 0.15) {
    prompt += ", {#ruins}";
    data.eerie = true;
    data.mystical = true;
    data.weather = true;
  } else if (_.random(0.0, 1.0, true) < 0.35) {
    prompt += ", {#city}";
    data.weather = true;
  }

  if (_.random(0.0, 1.0, true) < 0.2 && !data.animal) prompt += ", {#animal}";
  if (_.random(0.0, 1.0, true) < 0.35 && !data.eerie) prompt += ", {#eerie}";
  if (_.random(0.0, 1.0, true) < 0.35 && !data.mystical) prompt += ", {#mystical}";
  if (_.random(0.0, 1.0, true) < 0.35 && !data.weather) prompt += ", {#weather}";
  if (_.random(0.0, 1.0, true) < 0.2) prompt += ", artifact";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", dramatic lighting";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", intense";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", <dap>";
  if (_.random(0.0, 1.0, true) < 0.35) prompt += ", <detail/legacy>";

  return prompt;
}
