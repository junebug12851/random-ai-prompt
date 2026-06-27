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
import { isGatedDynPrompt } from "../../gatedLists.js";

/**
 * Build the `{#name}` dynamic-prompt stage bound to a loader (loader-injected port;
 * suffix-resolved, auto-fx/artists, danbooru substitution).
 * @param {object} loader The loader (`{ loadDynamicPrompt, dynamicPromptNames }`).
 * @returns {Function} The stage `(prompt, settings, imageSettings, upscaleSettings) => string`.
 */
// Intensity dial carried on a `{#name NN%}` reference (1..100; unspecified → default; 0 → 1). The
// resolver parses it and hands it to the generator as a 4th argument. See
// notes/reference/intensity-design.md.
const DEFAULT_INTENSITY = 50;

/** Normalize a `{#name NN%}` percent capture to an integer 1..100 (absent → default, 0 → 1). */
function parseIntensity(raw) {
  if (raw == null || raw === "") return DEFAULT_INTENSITY;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_INTENSITY;
  if (n <= 0) return 1;
  return n > 100 ? 100 : n;
}

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

  function run(key, settings, imageSettings, upscaleSettings, intensity = DEFAULT_INTENSITY) {
    const mod = loader.loadDynamicPrompt(key);
    if (!mod || typeof mod.default !== "function") return "";
    const out = danbooruReplacer(
      mod.default(settings, imageSettings, upscaleSettings, intensity),
      settings,
    );
    // Hoist this block's optional `Auto Begin` / `Auto End` framing to the prompt's start/end, when
    // the caller opted in by passing an `autoSink` collector (the SPA's "use block auto-sections"
    // toggle).
    const sink = settings.autoSink;
    if (sink) {
      if (mod.hasAutoBegin && typeof mod.autoBegin === "function") {
        const b = mod.autoBegin(settings, imageSettings, upscaleSettings, intensity);
        if (b && b.trim()) sink.begin.push(b.trim());
      }
      if (mod.hasAutoEnd && typeof mod.autoEnd === "function") {
        const e = mod.autoEnd(settings, imageSettings, upscaleSettings, intensity);
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
    // Gating: a generator is adult when its `.json` sidecar carries `nsfw: true` OR its name
    // carries an `nsfw` token (the automatic rule lists use). Either way it is hidden (empty)
    // unless adult is on — "acts like it doesn't exist".
    const isNsfw = (key) => loader.readDynPromptMeta?.(key)?.nsfw === true || isGatedDynPrompt(key);
    const gateOk = (key) => includeAdult || !isNsfw(key);

    // Pick ONE generator from a pool (a group's members, or the whole catalog for {#any}),
    // honoring an explicit sfw/nsfw variant or the adult-mode default.
    function pickFrom(pool, variant, intensity = DEFAULT_INTENSITY) {
      let ok;
      if (variant === "sfw") ok = pool.filter((n) => !isNsfw(n));
      else if (variant === "nsfw")
        ok = includeAdult ? pool : []; // -nsfw is nothing when adult off
      else ok = includeAdult ? pool : pool.filter((n) => !isNsfw(n));
      const key = ok.length ? _.sample(ok) : null;
      return key ? run(key, settings, imageSettings, upscaleSettings, intensity) : "";
    }

    // Resolve one `{#…}` reference at a given intensity (1..100).
    function expandGen(name, intensity = DEFAULT_INTENSITY) {
      if (name.startsWith("user-")) name = name.slice("user-".length); // back-compat alias
      const resolvePool = [...names, ...groups];

      // {#any} family — one random generator from the whole catalog.
      if (isReservedAny(name)) {
        const m = name.match(/-(sfw|nsfw)$/i);
        return pickFrom(names, m ? m[1].toLowerCase() : null, intensity);
      }

      const canonical = resolveName(name, resolvePool);

      // Implied folder group ({#scene}) — pick one random member generator.
      if (groups.includes(canonical))
        return pickFrom(dynGroupMembers(canonical, names), null, intensity);

      // Explicit `<name>.group` file — pick one random member.
      const groupFile = loader.readDynPromptGroup ? loader.readDynPromptGroup(canonical) : null;
      if (groupFile) {
        const members = groupFile
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, names));
        return pickFrom(members, null, intensity);
      }

      // Direct generator — gated out (empty) when adult is off.
      if (!gateOk(canonical)) return "";
      return run(canonical, settings, imageSettings, upscaleSettings, intensity);
    }

    const includedArtists =
      prompt.includes("{#artists}") ||
      prompt.includes("artist") ||
      imageSettings.autoIncludedArtists;
    const includedFx = prompt.includes("{#fx}") || imageSettings.autoIncludedFx;

    // Dynamic prompts are written `{#name}` (brace-delimited, uniform with `{list}`, and able to
    // carry `/` paths like `{#scene/beach}`). An optional ` NN%` is the intensity dial
    // (`{#beach 25%}`); absent → the default. Relative `+NN%`/`-NN%` forms are resolved to an
    // absolute percent inside the DPL renderer before they reach here.
    const maxCount = 10;
    for (let i = 0; i < maxCount && prompt.includes("{#"); i++) {
      prompt = prompt.replaceAll(/\{#([\w/-]+)(?:\s+(\d{1,3})%)?\}/g, (match, p1, p2) =>
        expandGen(p1, parseIntensity(p2)),
      );
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
