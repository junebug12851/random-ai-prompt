/**
 * @file
 * @brief core/ port of the <name> stage (loader-injected).
 */

// Expansion stage: `<name>` -> contents of expansions/name.txt.
// Loader-injected port of prompt-modules/expansion.js (no fs); the loader
// supplies the expansion text so the same logic runs in Node and the browser.
//
// A category FOLDER with 2+ expansions is an IMPLIED group: `<lighting>` splices ONE random
// expansion from that folder (the pick-one analog of the lists' folder groups, but the unit
// is a whole snippet). `.group` files work too. Gate-aware by name token.
import _ from "lodash";
import { resolveName } from "../../listManifest.js";
import { hasNsfwToken } from "../../gatedLists.js";

/**
 * Build the `<name>` expansion stage bound to a loader (loader-injected port, LoRA-safe).
 * @param {object} loader The loader (`{ readExpansion, expansionNames, expansionGroupDirs, readExpansionGroup }`).
 * @returns {Function} The expansion stage `(prompt, settings) => string`.
 */
export function makeExpansionStage(loader) {
  const loraFind = "<lora:";
  const loraReplacement = "%%lora:";

  return function expansion(prompt, settings) {
    const maxCount = 10;
    const names = loader.expansionNames ? loader.expansionNames() : [];
    const groupDirs = loader.expansionGroupDirs ? loader.expansionGroupDirs() : [];
    const resolvePool = [...names, ...groupDirs];
    const includeAdult = !!(settings && settings.includeAdult === true);

    // Splice one random member of a group (gate-aware): a folder's expansions, or a .group.
    const pickText = (members) => {
      const ok = includeAdult ? members : members.filter((n) => !hasNsfwToken(n));
      if (!ok.length) return "";
      const text = loader.readExpansion(_.sample(ok), settings);
      return text == null ? "" : text;
    };

    function expandOne(ref) {
      const canonical = resolveName(ref, resolvePool);
      // Implied folder group (<lighting>) -> one random expansion in that folder.
      if (groupDirs.includes(canonical)) {
        const members = names.filter(
          (n) => n.startsWith(`${canonical}/`) && !n.slice(canonical.length + 1).includes("/"),
        );
        return pickText(members);
      }
      // Explicit `<name>.group` file -> one random member.
      const gf = loader.readExpansionGroup ? loader.readExpansionGroup(canonical) : null;
      if (gf) {
        const members = gf
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, names));
        return pickText(members);
      }
      // Expansions are unified into dynamic prompts (DPL): `<name>` is now an ALIAS for `{#name}`.
      // A loader that still has the expansion (a user's saved custom `<name>`) splices it; anything
      // else routes to the dynamic-prompt of the same name, which the next pipeline pass resolves.
      const text = loader.readExpansion(ref, settings);
      return text == null ? `{#${ref}}` : text;
    }

    // Lora syntax (<lora:name:weight>) collides with expansion syntax; mask it.
    prompt = prompt.replaceAll(loraFind, loraReplacement);

    for (let i = 0; i < maxCount && /<(.*?)>/gm.test(prompt); i++) {
      prompt = prompt.replaceAll(loraFind, loraReplacement);
      prompt = prompt.replaceAll(/<(.*?)>/gm, (match, p1) => expandOne(p1));
    }

    prompt = prompt.replaceAll(loraReplacement, loraFind);
    return prompt;
  };
}
