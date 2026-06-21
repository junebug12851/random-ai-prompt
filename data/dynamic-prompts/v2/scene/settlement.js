/**
 * @file
 * @brief Partial dynamic-prompt fragment (#settlement): a building block composed into full prompts. See notes/reference/dynamic-prompts.md.
 */

import _ from "lodash";

/**
 * Generate the `#settlement` dynamic-prompt fragment. See notes/reference/dynamic-prompts.md.
 * @returns {string} The generated prompt fragment.
 */
export default function () {
  let prompt = "";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", [[house]]";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", [[village]]";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", [[path]]";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", worn down";

  if (_.random(0.0, 1.0, true) < 0.5) prompt += ", weathered";

  return prompt;
}
