/**
 * @file
 * @brief core/ port of the #name stage (loader-injected).
 */

// Dynamic-prompt stage: `#name` -> the output of dynamic-prompts/name.js.
// Loader-injected port of prompt-modules/dynamic-prompt.js. The loader returns
// the plugin module namespace ({ default, full, suggestion_exclude }); we call
// `.default(...)`. Same expansion/danbooru/auto-fx logic in Node and the browser.
export function makeDynamicPromptStage(loader) {
  function danbooruReplacer(prompt, settings) {
    if (
      settings.keywordsFilename == false ||
      (!String(settings.keywordsFilename).startsWith("d-") &&
        settings.keywordsFilename != "danbooru")
    ) {
      return prompt;
    }
    return prompt.replaceAll(/, ?Person/gim, "{d-person}");
  }

  function convertToPath(name) {
    if (!name.startsWith("user-")) return name;
    name = name.replace("user-", "");
    return `user-submitted/${name}`;
  }

  function run(key, settings, imageSettings, upscaleSettings) {
    const mod = loader.loadDynamicPrompt(key);
    if (!mod || typeof mod.default !== "function") return "";
    return danbooruReplacer(mod.default(settings, imageSettings, upscaleSettings), settings);
  }

  function expandV2(name, settings, imageSettings, upscaleSettings) {
    name = name.replace("-v2", "");
    return run(convertToPath(name), settings, imageSettings, upscaleSettings);
  }

  function expandV1(name, settings, imageSettings, upscaleSettings) {
    // V1 prompts already bundle fx + artists.
    settings.autoAddFx = false;
    settings.autoAddArtists = false;
    name = name.replace("-v1", "");
    return run(`v1/${convertToPath(name)}`, settings, imageSettings, upscaleSettings);
  }

  return function dynamicPrompt(prompt, settings, imageSettings, upscaleSettings) {
    const includedArtists =
      prompt.includes("#artists") || prompt.includes("artist") || imageSettings.autoIncludedArtists;
    const includedFx = prompt.includes("#fx") || imageSettings.autoIncludedFx;

    const maxCount = 10;
    for (let i = 0; i < maxCount && /#([\w\-_]+)/gm.test(prompt); i++) {
      prompt = prompt.replaceAll(/#([\w\-_]+)/gm, (match, p1) =>
        p1.endsWith("-v1")
          ? expandV1(p1, settings, imageSettings, upscaleSettings)
          : expandV2(p1, settings, imageSettings, upscaleSettings),
      );
    }

    if (settings.autoAddFx && !includedFx) {
      prompt += `, ${expandV2("fx", settings, imageSettings, upscaleSettings)}`;
      imageSettings.autoIncludedFx = true;
    }
    if (settings.autoAddArtists && !includedArtists) {
      prompt += `, ${expandV2("artists", settings, imageSettings, upscaleSettings)}`;
      imageSettings.autoIncludedArtists = true;
    }

    imageSettings.origPostPrompt = prompt;
    return prompt;
  };
}
