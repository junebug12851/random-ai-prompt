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
    // Every generation is FIRST CLASS: v3 is the DEFAULT (bare `{#name}`); v1 and v2 are FROZEN
    // but otherwise identical — same suffix resolution, the same implied folder groups, the same
    // `{#any}` wildcard — reached by their path prefix (`{#v1/…}`, `{#v2/…}`). There is no
    // `-v1`/`-v2` suffix form. The only differences for a frozen generation: it's addressed by
    // prefix, and it bundles its own fx + artists (so the auto-append is turned off).
    const names = loader.dynamicPromptNames();
    const groupAll = loader.dynPromptGroupDirsAll
      ? loader.dynPromptGroupDirsAll()
      : loader.dynPromptGroupDirs
        ? loader.dynPromptGroupDirs()
        : [];
    const GENS = {
      "": { pool: names.filter((n) => n.startsWith("v3/")), groups: groupAll.filter((d) => d.startsWith("v3/")), frozen: false },
      v1: { pool: names.filter((n) => n.startsWith("v1/")), groups: groupAll.filter((d) => d.startsWith("v1/")), frozen: true },
      v2: { pool: names.filter((n) => n.startsWith("v2/")), groups: groupAll.filter((d) => d.startsWith("v2/")), frozen: true },
    };
    const includeAdult = settings.includeAdult === true;
    // Gating: a generator whose name carries an `nsfw` token is hidden (empty) unless
    // adult is on — the same automatic rule lists/expansions use.
    const gateOk = (key) => includeAdult || !isGatedDynPrompt(key);

    // Pick ONE generator from a pool (a group's members, or the whole generation for {#any}),
    // honoring an explicit sfw/nsfw variant or the adult-mode default.
    function pickFrom(pool, variant) {
      let ok;
      if (variant === "sfw") ok = pool.filter((n) => !hasNsfwToken(n));
      else if (variant === "nsfw")
        ok = includeAdult ? pool : []; // -nsfw is nothing when adult off
      else ok = includeAdult ? pool : pool.filter((n) => !hasNsfwToken(n));
      const key = ok.length ? _.sample(ok) : null;
      return key ? run(key, settings, imageSettings, upscaleSettings) : "";
    }

    // Resolve one `{#…}` within a generation (tag "" = active v3, "v1"/"v2" = frozen).
    function expandGen(name, tag) {
      const g = GENS[tag];
      if (tag) name = name.replace(new RegExp(`^${tag}/`), ""); // drop the generation prefix
      if (name.startsWith("user-")) name = name.slice("user-".length); // back-compat alias
      if (g.frozen) {
        settings.autoAddFx = false; // frozen generations bake in fx + artists
        settings.autoAddArtists = false;
      }
      const resolvePool = [...g.pool, ...g.groups];

      // {#any-ver} — one random generator from ALL generations (a global wildcard; unprefixed).
      const anyVer = name.match(/^any-ver(?:-(sfw|nsfw))?$/i);
      if (anyVer) return pickFrom(names, anyVer[1] ? anyVer[1].toLowerCase() : null);

      // {#any} family — one random generator from this generation (the default v3 unless prefixed).
      if (isReservedAny(name)) {
        const m = name.match(/-(sfw|nsfw)$/i);
        return pickFrom(g.pool, m ? m[1].toLowerCase() : null);
      }

      const canonical = resolveName(name, resolvePool);

      // Implied folder group ({#scene} / {#v2/scene}) — pick one random member generator.
      if (g.groups.includes(canonical)) return pickFrom(dynGroupMembers(canonical, g.pool), null);

      // Explicit `<name>.group` file — pick one random member.
      const groupFile = loader.readDynPromptGroup ? loader.readDynPromptGroup(canonical) : null;
      if (groupFile) {
        const members = groupFile
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, g.pool));
        return pickFrom(members, null);
      }

      // Direct generator — gated out (empty) when adult is off.
      if (!gateOk(canonical)) return "";
      return run(canonical, settings, imageSettings, upscaleSettings);
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
      prompt = prompt.replaceAll(/\{#([\w/-]+)\}/g, (match, p1) => {
        if (p1.startsWith("v1/")) return expandGen(p1, "v1");
        if (p1.startsWith("v2/")) return expandGen(p1, "v2");
        return expandGen(p1, "");
      });
    }

    if (settings.autoAddFx && !includedFx) {
      prompt += `, ${expandGen("fx", "")}`;
      imageSettings.autoIncludedFx = true;
    }
    if (settings.autoAddArtists && !includedArtists) {
      prompt += `, ${expandGen("artists", "")}`;
      imageSettings.autoIncludedArtists = true;
    }

    imageSettings.origPostPrompt = prompt;
    return prompt;
  };
}
