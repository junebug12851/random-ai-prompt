/**
 * @file
 * @brief core/ port of the {name} stage (loader-injected).
 */

import { randomFloat, shuffle } from "../../helpers/random.js";
import randomEmphasis from "../../helpers/randomEmphasis.js";
import randomEditing from "../../helpers/randomEditing.js";
import randomAlternating from "../../helpers/randomAlternating.js";

// List stage: `{name}` -> a random line from lists/name.txt, with the
// emphasis/editing/alternating randomization. Loader-injected port of
// prompt-modules/list.js; the pure random* helpers are reused as-is and the
// file access goes through the list store.
/**
 * Build the `{name}` list stage bound to a list store (loader-injected port).
 * @param {object} store The list store (`{ pull }`).
 * @returns {Function} The list stage `(prompt, settings) => string`.
 */
export function makeListStage(store) {
  const promptFuncsSd = [randomEmphasis, randomEditing, randomAlternating];
  const promptFuncsNai = [randomEmphasis, randomAlternating];
  const promptFuncsMdj = [randomEmphasis, randomAlternating];
  let promptFuncsTmp = [];

  function sampleFile(name, settings, emphasis) {
    emphasis = emphasis === undefined ? true : Boolean(emphasis);

    if (!emphasis || randomFloat() > settings.emphasisChance) return store.pull(settings, name);

    let targList = promptFuncsSd;
    if (settings.mode == "NovelAI") targList = promptFuncsNai;
    else if (settings.mode == "Midjourney") targList = promptFuncsMdj;

    if (promptFuncsTmp.length == 0) promptFuncsTmp = [...targList];
    promptFuncsTmp = shuffle(promptFuncsTmp);

    name = `{${name}}`;
    name = promptFuncsTmp[0](settings, name).keyword;
    promptFuncsTmp.splice(0, 1);

    name = name.replaceAll(/\{([^{}\n]*)\}/gm, (match, p1) => store.pull(settings, p1));

    if (settings.mode == "NovelAI") {
      name = name.replaceAll("(", "{").replaceAll(")", "}");
    }

    return name;
  }

  return function list(prompt, settings) {
    // Reset the func-rotation bag at the START of every generation. It's closure state that would
    // otherwise carry leftover residue from the previous generate() call — and since the SPA engine is
    // a module singleton (built once), that residue made two runs of the SAME seed diverge as soon as
    // emphasis fired (the bag's starting contents differed). Resetting per generation makes a seeded
    // run fully reproducible while still rotating the funcs within a single prompt. (Node tests missed
    // this because they built a fresh engine per call, so the bag was always already empty.)
    promptFuncsTmp = [];
    return prompt.replaceAll(/\{([^{}\n]*)\}/gm, (match, p1) => {
      // `{#name}` is a dynamic-prompt token (handled by the dynamic-prompt stage), not a
      // list — leave any stray one intact rather than mis-pulling a list named "#name".
      if (p1.startsWith("#")) return match;
      if (p1 == settings.artistFilename || p1.includes("artist"))
        return sampleFile(p1, settings, false);
      return sampleFile(p1, settings, settings.keywordEmphasis);
    });
  };
}
