/**
 * @file
 * @brief core/ port of the #name stage (loader-injected).
 */

// Dynamic-prompt stage: `{#name}` -> the output of the matching generator.
// Loader-injected port. The loader returns the plugin module namespace
// ({ default, suggestion_exclude }); we call `.default(...)`. Same
// danbooru/auto-fx logic in Node and the browser.
//
// Generators live flat under data/dynamic-prompts/<category>/. A bare `{#name}` is
// resolved by PATH SUFFIX (the same rule lists use), so references stay short and
// folder-independent; `{#category/name}` addresses one explicitly.
import { sample } from "../../helpers/random.js";
import { resolveName } from "../../listManifest.js";
import { isReservedAny, dynGroupMembers } from "../../dynPromptManifest.js";
import { isGatedDynPrompt } from "../../gatedLists.js";

/**
 * Build the `{#name}` dynamic-prompt stage bound to a loader (loader-injected port;
 * suffix-resolved, auto-fx/artists, danbooru substitution).
 * @param {object} loader The loader (`{ loadDynamicPrompt, dynamicPromptNames }`).
 * @returns {Function} The stage `(prompt, settings, imageSettings, upscaleSettings) => string`.
 */
// Dials carried on a `{#name …}` reference: intensity ("how much", 4th generator arg) and focus
// ("how pure / how narrow", 5th arg). Both are 1..100, default 50, 0→1. The dial prefix `i`/`f` is
// MANDATORY — `{#name i25% f80%}` — because the two percents are visually identical; an unprefixed
// `NN%` is not dial syntax. See notes/reference/intensity-design.md and notes/reference/focus-design.md.
const DEFAULT_INTENSITY = 50;
const DEFAULT_FOCUS = 50;

/** Clamp a percent capture to an integer 1..100 (absent/NaN → default, 0 → 1, >100 → 100). */
function clampDial(raw, dflt) {
  if (raw == null || raw === "") return dflt;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return dflt;
  if (n <= 0) return 1;
  return n > 100 ? 100 : n;
}

/**
 * Parse the optional dial-argument blob after a `{#name …}` token into `{ intensity, focus }`. Args are
 * `i`/`f`-prefixed percents (`{#name i25% f80%}`); the prefix is mandatory (an unprefixed `NN%` never
 * reaches here — the resolver regex only matches prefixed args).
 * @param {string} blob The captured argument text (may be empty).
 * @returns {{intensity: number, focus: number}} The two dials (defaults when unspecified).
 */
function parseArgs(blob) {
  let intensity = DEFAULT_INTENSITY;
  let focus = DEFAULT_FOCUS;
  if (blob) {
    const re = /([if])(\d{1,3})%/gi;
    let m;
    while ((m = re.exec(blob))) {
      if (m[1].toLowerCase() === "f") focus = clampDial(m[2], DEFAULT_FOCUS);
      else intensity = clampDial(m[2], DEFAULT_INTENSITY);
    }
  }
  return { intensity, focus };
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

  function run(
    key,
    settings,
    imageSettings,
    upscaleSettings,
    intensity = DEFAULT_INTENSITY,
    focus = DEFAULT_FOCUS,
    dedup = null,
  ) {
    const mod = loader.loadDynamicPrompt(key);
    if (!mod || typeof mod.default !== "function") return "";
    // Global single-layer auto-merge: a generator renders ONCE per prompt and behaves as a shared
    // global layer. The first occurrence (including any the user typed) renders and is recorded; a
    // later IMPORT of the same SINGULAR generator renders empty (it was "already imported"). A
    // generator flagged `stacking` is exempt and may render every time (decorative fragments). See
    // notes/reference/layering-design.md.
    if (dedup) {
      if (mod.stacking !== true) {
        if (!dedup.firstPass && dedup.seen.has(key)) return "";
        dedup.seen.add(key);
      }
    }
    const out = danbooruReplacer(
      mod.default(settings, imageSettings, upscaleSettings, intensity, focus),
      settings,
    );
    // Hoist this block's optional `Auto Begin` / `Auto End` framing to the prompt's start/end, when
    // the caller opted in by passing an `autoSink` collector (the SPA's "use block auto-sections"
    // toggle).
    const sink = settings.autoSink;
    if (sink) {
      if (mod.hasAutoBegin && typeof mod.autoBegin === "function") {
        const b = mod.autoBegin(settings, imageSettings, upscaleSettings, intensity, focus);
        if (b && b.trim()) sink.begin.push(b.trim());
      }
      if (mod.hasAutoEnd && typeof mod.autoEnd === "function") {
        const e = mod.autoEnd(settings, imageSettings, upscaleSettings, intensity, focus);
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
    function pickFrom(pool, variant, intensity, focus, dedup) {
      let ok;
      if (variant === "sfw") ok = pool.filter((n) => !isNsfw(n));
      else if (variant === "nsfw")
        ok = includeAdult ? pool : []; // -nsfw is nothing when adult off
      else ok = includeAdult ? pool : pool.filter((n) => !isNsfw(n));
      const key = ok.length ? sample(ok) : null;
      return key ? run(key, settings, imageSettings, upscaleSettings, intensity, focus, dedup) : "";
    }

    // Resolve one `{#…}` reference at a given intensity + focus (1..100), threading the dedup state.
    function expandGen(name, intensity, focus, dedup) {
      if (name.startsWith("user-")) name = name.slice("user-".length); // back-compat alias
      const resolvePool = [...names, ...groups];

      // {#any} family — one random generator from the whole catalog.
      if (isReservedAny(name)) {
        const m = name.match(/-(sfw|nsfw)$/i);
        return pickFrom(names, m ? m[1].toLowerCase() : null, intensity, focus, dedup);
      }

      const canonical = resolveName(name, resolvePool);

      // Implied folder group ({#scene}) — pick one random member generator.
      if (groups.includes(canonical))
        return pickFrom(dynGroupMembers(canonical, names), null, intensity, focus, dedup);

      // Explicit `<name>.group` file — pick one random member.
      const groupFile = loader.readDynPromptGroup ? loader.readDynPromptGroup(canonical) : null;
      if (groupFile) {
        const members = groupFile
          .map((l) => l.replace(/\r$/, "").trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("@"))
          .map((l) => resolveName(l, names));
        return pickFrom(members, null, intensity, focus, dedup);
      }

      // Direct generator — gated out (empty) when adult is off.
      if (!gateOk(canonical)) return "";
      return run(canonical, settings, imageSettings, upscaleSettings, intensity, focus, dedup);
    }

    const includedArtists =
      prompt.includes("{#artists}") ||
      prompt.includes("artist") ||
      imageSettings.autoIncludedArtists;
    const includedFx = prompt.includes("{#fx}") || imageSettings.autoIncludedFx;

    // Auto-append the fx / artists generators as TOKENS *before* the resolution loop, so the loop
    // resolves them — and any nested `{#…}` they emit — in the same passes. (Appending their
    // already-rendered output *after* the loop, as this used to, left a nested token unresolved in
    // the final prompt, e.g. a literal `{#rays}`.)
    if (settings.autoAddFx && !includedFx) {
      prompt += `, {#fx}`;
      imageSettings.autoIncludedFx = true;
    }
    if (settings.autoAddArtists && !includedArtists) {
      prompt += `, {#artists}`;
      imageSettings.autoIncludedArtists = true;
    }

    // Dynamic prompts are written `{#name}` (brace-delimited, uniform with `{list}`, and able to
    // carry `/` paths like `{#scene/beach}`). An optional ` NN%` is the intensity dial
    // (`{#beach 25%}`); absent → the default. Relative `+NN%`/`-NN%` forms are resolved to an
    // absolute percent inside the DPL renderer before they reach here.
    // Global single-layer dedup state for THIS prompt expansion. The first pass operates on the
    // original (user-typed) prompt — those tokens always render; later passes resolve nested IMPORTS,
    // which dedup against what is already there (unless the generator is `stacking`).
    const dedup = { seen: new Set(), firstPass: true };
    const maxCount = 10;
    for (let i = 0; i < maxCount && prompt.includes("{#"); i++) {
      dedup.firstPass = i === 0;
      prompt = prompt.replaceAll(/\{#([\w/-]+)((?:\s+[if]\d{1,3}%)*)\}/gi, (match, name, blob) => {
        const { intensity, focus } = parseArgs(blob);
        return expandGen(name, intensity, focus, dedup);
      });
    }

    imageSettings.origPostPrompt = prompt;
    return prompt;
  };
}
