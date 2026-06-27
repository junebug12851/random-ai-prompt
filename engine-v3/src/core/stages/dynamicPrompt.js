/**
 * @file
 * @brief core/ port of the #name stage (loader-injected).
 */

// Dynamic-prompt stage: `{#name}` -> the output of the matching generator.
// Loader-injected port. The loader returns the plugin module namespace
// ({ default, full, suggestion_exclude }); we call `.default(...)`. Same
// danbooru/auto-fx logic in Node and the browser.
//
// Generators live flat under data/dynamic-prompts/<category>/. A bare `{#name}` is
// resolved by PATH SUFFIX (the same rule lists use), so references stay short and
// folder-independent; `{#category/name}` addresses one explicitly.
import _ from "lodash";
import { resolveName } from "../../listManifest.js";
import { isReservedAny, dynGroupMembers } from "../../dynPromptManifest.js";
import { isGatedDynPrompt, hasNsfwToken } from "../../gatedLists.js";

/**
 * Build the `{#name}` dynamic-prompt stage bound to a loader (loader-injected port;
 * suffix-resolved, auto-fx/artists, danbooru substitution).
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
    const out = danbooruReplacer(mod.default(settings, imageSettings, upscaleSettings), settings);
    // Hoist this block's optional `Auto Begin` / `Auto End` framing to the prompt's start/end, when
    // the caller opted in by passing an `autoSink` collector (the SPA's "use block auto-sections"
    // toggle).
    const sink = settings.autoSink;
    if (sink) {
      if (mod.hasAutoBegin && typeof mod.autoBegin === "function") {
        const b = mod.autoBegin(settings, imageSettings, upscaleSettings);
        if (b && b.trim()) sink.begin.push(b.trim());
      }
      if (mod.hasAutoEnd && typeof mod.autoEnd === "function") {
        const e = mod.autoEnd(settings, imageSettings, upscaleSettings);
        if (e && e.trim()) sink.end.push(e.trim());
      }
    }
    return out;
  }

  return function dynamicPrompt(prompt, settings, imageSettings, upscaleSettings) {
    // A single, flat catalog: every generator is FIRST CLASS, addressed by a bare `{#name}`
    // (suffix-resolved, the same rule lists use) or a `{#category/name}` path. The `{#any}`
    // wildcard and the implied folder groups span the whole catalog.
    const names = loader.dynamicPromptNames();
    const groups = loader.dynPromptGroupDirsAll
      ? loader.dynPromptGroupDirsAll()
      : loader.dynPromptGroupDirs
        ? loader.dynPromptGroupDirs()
        : [];
    const includeAdult = settings.includeAdult === true;
    // Gating: a generator whose name carries an `nsfw` token is hidden (empty) unless
    // adult is on — the same automatic rule lists use.
    const gateOk = (key) => includeAdult || !isGatedDynPrompt(key);

    // Pick ONE generator from a pool (a group's members, or the whole catalog for {#any}),
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

    // Resolve one `{#…}` reference.
    function expandGen(name) {
      if (name.startsWith("user-")) name = name.slice("user-".length); // back-compat alias
      const resolvePool = [...names, ...groups];

      // {#any} family — one random generator from the whole catalog.
      if (isReservedAny(name)) {
        const m = name.match(/-(sfw|nsfw)$/i);
        return pickFrom(names, m ? m[1].toLowerCase() : null);
      }

      const canonical = resolveName(name, resolvePool);

      // Implied folder group ({#scene}) — pick one random member generator.
      if (groups.includes(canonical)) return pickFrom(dynGroupMembers(canonical, names), null);

      // Explicit `<name>.group` file — pick one random member.
      const groupFile = loader.readDynPromptGroup ? loader.readDynPromptGroup(canonical) : null;
      if (groupFile) {
        const members = groupFile
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, names));
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

    // Dynamic prompts are written `{#name}` (brace-delimited, uniform with `{list}`, and able to
    // carry `/` paths like `{#scene/beach}`).
    const maxCount = 10;
    for (let i = 0; i < maxCount && prompt.includes("{#"); i++) {
      prompt = prompt.replaceAll(/\{#([\w/-]+)\}/g, (match, p1) => expandGen(p1));
    }

    if (settings.autoAddFx && !includedFx) {
      prompt += `, ${expandGen("fx")}`;
      imageSettings.autoIncludedFx = true;
    }
    if (settings.autoAddArtists && !includedArtists) {
      prompt += `, ${expandGen("artists")}`;
      imageSettings.autoIncludedArtists = true;
    }

    imageSettings.origPostPrompt = prompt;
    return prompt;
  };
}
