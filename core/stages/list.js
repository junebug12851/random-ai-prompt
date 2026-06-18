import _ from "lodash";
import randomEmphasis from "../../helpers/randomEmphasis.js";
import randomEditing from "../../helpers/randomEditing.js";
import randomAlternating from "../../helpers/randomAlternating.js";

// List stage: `{name}` -> a random line from lists/name.txt, with the
// emphasis/editing/alternating randomization. Loader-injected port of
// prompt-modules/list.js; the pure random* helpers are reused as-is and the
// file access goes through the list store.
export function makeListStage(store) {
  const promptFuncsSd = [randomEmphasis, randomEditing, randomAlternating];
  const promptFuncsNai = [randomEmphasis, randomAlternating];
  const promptFuncsMdj = [randomEmphasis, randomAlternating];
  let promptFuncsTmp = [];

  function sampleFile(name, settings, emphasis) {
    emphasis = emphasis === undefined ? true : emphasis == true;

    if (!emphasis || _.random(0.0, 1.0, true) > settings.emphasisChance)
      return store.pull(settings, name);

    let targList = promptFuncsSd;
    if (settings.mode == "NovelAI") targList = promptFuncsNai;
    else if (settings.mode == "Midjourney") targList = promptFuncsMdj;

    if (promptFuncsTmp.length == 0) promptFuncsTmp = _.clone(targList);
    promptFuncsTmp = _.shuffle(promptFuncsTmp);

    name = `{${name}}`;
    name = promptFuncsTmp[0](settings, name).keyword;
    promptFuncsTmp.splice(0, 1);

    name = name.replaceAll(/\{(.*?)\}/gm, (match, p1) => store.pull(settings, p1));

    if (settings.mode == "NovelAI") {
      name = name.replaceAll("(", "{").replaceAll(")", "}");
    }

    return name;
  }

  return function list(prompt, settings) {
    return prompt.replaceAll(/\{(.*?)\}/gm, (match, p1) => {
      if (p1 == settings.artistFilename || p1.includes("artist"))
        return sampleFile(p1, settings, false);
      return sampleFile(p1, settings, settings.keywordEmphasis);
    });
  };
}
