/**
 * @file
 * @brief JS sidecar for entity.dpl — the polymorphic subject type-system (picks animal / character /
 *        flower / instrument / creature / tree / person, with humanlike extras). Ported from v2
 *        subject/entity.js; reused by the animal/person/living-entity/entity-name wrappers.
 */

import _ from "lodash";

const anyEntity = [0, 1, 2, 3, 4, 5, 6];
const humanEntity = [1, 6];
const animalEntity = [0, 4];
const livingEntity = [0, 1, 4, 6];

/**
 * Generate an entity subject.
 * @param {object} settings Settings.
 * @param {object} imageSettings Image settings.
 * @param {object} upscaleSettings Upscale settings.
 * @param {string} [specificEntity] One of "human" | "animal" | "living" to restrict the pool.
 * @param {boolean} [nameOnly] Emit just the subject token (no emotion/hair/clothes).
 * @returns {string} The generated prompt fragment.
 */
export default function (settings, imageSettings, upscaleSettings, specificEntity, nameOnly) {
  let prompt = "";
  if (nameOnly == undefined) nameOnly = false;

  let emotion = false;
  let human = false;
  let index = anyEntity[_.random(0, anyEntity.length - 1, false)];

  if (specificEntity == "human") index = humanEntity[_.random(0, humanEntity.length - 1, false)];
  else if (specificEntity == "animal")
    index = animalEntity[_.random(0, animalEntity.length - 1, false)];
  else if (specificEntity == "living")
    index = livingEntity[_.random(0, livingEntity.length - 1, false)];

  switch (index) {
    case 0:
      prompt += `{animal}`;
      break;
    case 1:
      prompt += `{d/character}`;
      emotion = true;
      human = true;
      break;
    case 2:
      prompt += `{#color} {flower}`;
      break;
    case 3:
      prompt += `{instrument}`;
      break;
    case 4:
      prompt += `{mythological-creature}`;
      break;
    case 5:
      prompt += `{tree}`;
      break;
    case 6:
      prompt += `person`;
      emotion = true;
      human = true;
      break;
  }

  if (_.random(0.0, 1.0, true) < 0.5 && emotion && !nameOnly) prompt += ", {emotion}";
  if (_.random(0.0, 1.0, true) < 0.5 && human && !nameOnly) prompt += `, {#color} {hair}`;

  const clothingCount =
    _.random(0.0, 1.0, true) < 0.5 && human && !nameOnly ? _.random(0, 5, false) : 0;
  for (let i = 0; i < clothingCount; i++) prompt += `, {#color} {clothes}`;

  return prompt;
}
