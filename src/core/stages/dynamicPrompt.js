/**
 * @file
 * @brief core/ port of the #name stage (loader-injected).
 */

// Dynamic-prompt stage: `#name` -> the output of the matching v2 generator.
// Loader-injected port of prompt-modules/dynamic-prompt.js. The loader returns
// the plugin module namespace ({ default, full, suggestion_exclude }); we call
// `.default(...)`. Same expansion/danbooru/auto-fx logic in Node and the browser.
//
// Generators live under data/dynamic-prompts/v2/<category>/ (with v1/ frozen). A bare
// `#name` is resolved by PATH SUFFIX (the same rule lists/expansions use) against the v2
// catalog, so references stay short and folder-independent. `#name-v1` resolves against
// the frozen v1/ tree; `#user-name` is a back-compat alias for the v2/user/ generators.
import _ from "lodash";
import { resolveName } from "../../listManifest.js";
import { isReservedAny, dynGroupMembers } from "../../dynPromptManifest.js";
import { isGatedDynPrompt, hasNsfwToken } from "../../gatedLists.js";

/**
 * Build the `#name` dynamic-prompt stage bound to a loader (loader-injected port;
 * suffix-resolved v2 / frozen v1, auto-fx/artists, danbooru substitution).
 * @param {object} loader The loader (`{ loadDynamicPrompt, dynamicPromptNames }`).
 * @returns {Function} The stage `(prompt, settings, imageSettings, upscaleSettings) => string`.
 */
export function makeDynamicPromptStage(loader) {
  function danbooruReplacer(prompt, settings) {
    if (
      settings.keywordsFilename == false ||
      (!String(settings.keywordsFilename).startsWith("d/") &&
        settings.keywordsFilename != "danbooru")
    ) {
      return prompt;
    }
    return prompt.replaceAll(/, ?Person/gim, "{d/person}");
  }

  function run(key, settings, imageSettings, upscaleSettings) {
    const mod = loader.loadDynamicPrompt(key);
    if (!mod || typeof mod.default !== "function") return "";
    return danbooruReplacer(mod.default(settings, imageSettings, upscaleSettings), settings);
  }

  return function dynamicPrompt(prompt, settings, imageSettings, upscaleSettings) {
    // Split the catalog once: v1/ (frozen, reached only via #name-v1) vs the rest (v2,
    // reached by bare #name). Both resolve by path suffix, so categories stay invisible.
    const names = loader.dynamicPromptNames();
    const v1Names = names.filter((n) => n.startsWith("v1/"));
    const v2Names = names.filter((n) => !n.startsWith("v1/"));
    const groupDirs = loader.dynPromptGroupDirs ? loader.dynPromptGroupDirs() : [];
    // Group refs ({#scene}) are the folder's last segment; include the group-dir paths in
    // the resolution pool so a bare ref suffix-matches "v2/scene".
    const resolvePool = [...v2Names, ...groupDirs];
    const includeAdult = settings.includeAdult === true;
    // Gating: a generator whose name carries an `nsfw` token is hidden (empty) unless
    // adult is on — the same automatic rule lists/expansions use.
    const gateOk = (key) => includeAdult || !isGatedDynPrompt(key);

    // Pick ONE generator from a pool (a group's members, or the whole catalog for {#any}),
    // honoring an explicit sfw/nsfw variant or the adult-mode default — the generator-level
    // analog of the {keyword} wildcard's variant semantics.
    function pickFrom(pool, variant) {
      let ok;
      if (variant === "sfw") ok = pool.filter((n) => !hasNsfwToken(n));
      else if (variant === "nsfw")
        ok = includeAdult ? pool : []; // -nsfw is nothing when adult off
      else ok = includeAdult ? pool : pool.filter((n) => !hasNsfwToken(n));
      const key = ok.length ? _.sample(ok) : null;
      return key ? run(key, settings, imageSettings, upscaleSettings) : "";
    }

    function expandV2(name) {
      name = name.replace(/-v2$/, "");
      if (name.startsWith("user-")) name = name.slice("user-".length); // back-compat alias

      // {#any} family — one random generator from the WHOLE v2 catalog, with the optional
      // -sfw/-nsfw variant (the only ref that takes a variant; a real generator's own
      // nsfw-token name is resolved directly below).
      if (isReservedAny(name)) {
        const m = name.match(/-(sfw|nsfw)$/i);
        return pickFrom(v2Names, m ? m[1].toLowerCase() : null);
      }

      const canonical = resolveName(name, resolvePool);

      // Implied folder group ({#scene}) — pick one random member generator (gate-aware).
      if (groupDirs.includes(canonical)) return pickFrom(dynGroupMembers(canonical, v2Names), null);

      // Explicit `<name>.group` file — pick one random member.
      const groupFile = loader.readDynPromptGroup ? loader.readDynPromptGroup(canonical) : null;
      if (groupFile) {
        const members = groupFile
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, v2Names));
        return pickFrom(members, null);
      }

      // Direct generator — gated out (empty) when adult is off.
      if (!gateOk(canonical)) return "";
      return run(canonical, settings, imageSettings, upscaleSettings);
    }

    function expandV1(name) {
      // V1 prompts already bundle fx + artists.
      settings.autoAddFx = false;
      settings.autoAddArtists = false;
      name = name.replace(/-v1$/, "");
      return run(resolveName(name, v1Names), settings, imageSettings, upscaleSettings);
    }

    const includedArtists =
      prompt.includes("{#artists}") ||
      prompt.includes("artist") ||
      imageSettings.autoIncludedArtists;
    const includedFx = prompt.includes("{#fx}") || imageSettings.autoIncludedFx;

    // Dynamic prompts are written `{#name}` (brace-delimited, uniform with `{list}` and
    // `<expansion>`, and able to carry `/` paths like `{#scene/beach}`).
    const maxCount = 10;
    for (let i = 0; i < maxCount && prompt.includes("{#"); i++) {
      prompt = prompt.replaceAll(/\{#([\w/-]+)\}/g, (match, p1) =>
        p1.endsWith("-v1") ? expandV1(p1) : expandV2(p1),
      );
    }

    if (settings.autoAddFx && !includedFx) {
      prompt += `, ${expandV2("fx")}`;
      imageSettings.autoIncludedFx = true;
    }
    if (settings.autoAddArtists && !includedArtists) {
      prompt += `, ${expandV2("artists")}`;
      imageSettings.autoIncludedArtists = true;
    }

    imageSettings.origPostPrompt = prompt;
    return prompt;
  };
}
