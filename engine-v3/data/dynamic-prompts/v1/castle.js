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

/**
 * @file
 * @brief Legacy v1 dynamic-prompt generator (#castle-v1): a frozen, monolithic version of the scene, kept for reproducibility. See notes/reference/dynamic-prompts.md.
 */

import _ from "lodash";
import { artistRepeater } from "../../../src/helpers/keywordRepeater.js";

function maybeAddColor() {
  if (_.random(0.0, 1.0, true) < 0.5) return "{color} ";
  else return "";
}

function multiColor() {
  const addColor = _.random(0.0, 1.0, true) < 0.5;

  if (addColor && _.random(0.0, 1.0, true) < 0.5) return "multi color ";
  else if (addColor) return maybeAddColor();

  return "";
}

/**
 * Generate the `#castle-v1` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @param {object} settings The settings.
 * @param {object} imageSettings The imageSettings.
 * @param {object} upscaleSettings The upscaleSettings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings) {
  // Start with base prompt
  let prompt = "castle, {view}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", moat";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", motte";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", courtyard";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", castle keep";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", castle wall";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", fortified tower";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", castle drawbridge";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", castle gatehouse";

  if (_.random(0.0, 1.0, true) < 0.2) prompt += ", {mythological-creature}";

  if (_.random(0.0, 1.0, true) < 0.3) prompt += ", {animal}";

  if (_.random(0.0, 1.0, true) < 0.3) prompt += ", {animal}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {city}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", lake";
  else if (_.random(0.0, 1.0, true) < 0.5) prompt += ", pond";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {style/building}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {time}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, ${multiColor()}{flower}`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, ${multiColor()}{flower}`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, ${multiColor()}vegetation`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, {tree}`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += `, {tree}`;

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", vines";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {weather}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {weather}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {art-movement}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {art-technique}";

  const imageEffects = _.random(0.0, 1.0, true) < 0.5 ? _.random(0, 5, false) : 0;

  for (let i = 0; i < imageEffects; i++) prompt += ", {image-effect}";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", <rays>";

  // Add in artist
  const artists = artistRepeater("artist", true, settings);
  if (artists.length > 0) prompt += `, ${artists}`;

  return prompt;
}
