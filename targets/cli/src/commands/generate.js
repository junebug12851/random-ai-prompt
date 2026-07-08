/**
 * @file
 * @brief The `generate` command (also the default). Generates prompts from a template + settings and,
 * when a provider is selected with `--images`, runs each prompt through that provider's real adapter
 * (via the in-process backend), saving images to the shared `output/` folder just like the GUI.
 */
import { c, say } from "../lib/colors.js";
import { printJson } from "../lib/format.js";
import { effectiveSettings } from "../lib/settings.js";
import { resolvePresets } from "../lib/presets.js";
import { addGenerationFlags, overridesFromOptions } from "../lib/optionSpec.js";
import { generatePrompts } from "../lib/promptRun.js";
import { getProvider, engineModeFor } from "../lib/providers.js";
import { runProvider } from "../lib/imagegen.js";
import { startBackend, stopBackend } from "../lib/backend.js";

/**
 * Register the `generate` command (default) on the program.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerGenerate(program) {
  const cmd = program
    .command("generate", { isDefault: true })
    .aliases(["gen", "g"])
    .description("Generate prompts (and optionally images)")
    .argument("[prompt]", "Prompt template (DPL). Defaults to the saved/{#random-words} prompt")
    .option("-p, --provider <id>", "Image provider id (see: prompt list providers)")
    .option("--images", "Generate images with the selected provider")
    .option("--no-images", "Only generate text prompts (no images)")
    .option("--preset <names>", "Comma-separated presets to apply (see: prompt list presets)")
    .option("--seed <seed>", "Pin the prompt seed (reproducible batch)")
    .option("--random", "Force a fresh random prompt seed")
    .option("--nsfw", "Enable adult/NSFW content")
    .option("--no-gui-share", "Ignore the GUI's saved settings/keys");

  addGenerationFlags(cmd);

  cmd.action(async (promptArg, opts, command) => {
    const global = command.optsWithGlobals();
    const overrides = overridesFromOptions(command, opts);

    if (promptArg) overrides.prompt = promptArg;
    if (opts.nsfw) overrides.includeAdult = true;
    if (opts.seed !== undefined) {
      overrides.randomSeed = false;
      overrides.promptSeed = opts.seed;
    }
    if (opts.random) overrides.randomSeed = true;
    if (opts.images === true) overrides.generateImages = true;
    if (opts.images === false) overrides.generateImages = false;
    if (opts.provider) overrides.provider = opts.provider;

    let presets;
    try {
      presets = resolvePresets(opts.preset);
    } catch (e) {
      say("err", e.message);
      process.exitCode = 1;
      return;
    }

    const settings = effectiveSettings({ shareGui: opts.guiShare !== false, presets, overrides });

    // Resolve the provider and align the prompt dialect to it (unless the user forced --mode).
    const provider = (await getProvider(settings.provider)) || (await getProvider("plain"));
    if (!provider) {
      say("err", `Unknown provider "${settings.provider}". See: prompt list providers`);
      process.exitCode = 1;
      return;
    }
    if (overrides.mode === undefined) settings.mode = engineModeFor(provider.dialect);
    settings.provider = provider.id;

    // Generate the prompt batch.
    const { seed, prompts } = generatePrompts(settings);

    const wantImages = settings.generateImages && provider.tier === "api";
    // Copy-only providers just format the prompt (no network/cost), so always run them. An `api`
    // provider is only called when the user actually asked for images — so `prompt -p openai "x"`
    // without --images never spends credits; it just prints the prompt.
    const doRun = provider.tier !== "api" || wantImages;
    const needBackend =
      wantImages ||
      ((settings.autoFix || settings.autoKeyword) &&
        settings.rewriteProvider &&
        settings.rewriteProvider !== "none");

    const results = [];
    let failed = false;
    if (doRun) {
      if (needBackend) await startBackend();
      try {
        for (const prompt of prompts) {
          results.push(
            await runProvider({ prompt, promptDpl: settings.prompt, settings, provider }),
          );
        }
      } catch (e) {
        say("err", e.message || String(e));
        process.exitCode = 1;
        failed = true;
      } finally {
        if (needBackend) await stopBackend();
      }
    }
    if (failed) return;

    // --- Output ---
    if (global.json) {
      printJson({
        seed,
        provider: provider.id,
        providerLabel: provider.label,
        mode: settings.mode,
        count: prompts.length,
        results: results.map((r, i) => ({
          index: i + 1,
          prompt: r.text ?? prompts[i],
          copy: r.copy === true,
          images: r.images || [],
        })),
      });
      return;
    }

    prompts.forEach((prompt, i) => {
      const r = results[i] || { text: prompt, images: [] };
      if (!settings.hidePrompt) {
        const label = prompts.length > 1 ? c.muted(`${String(i + 1).padStart(2)}. `) : "";
        console.log(label + c.value(r.text ?? prompt));
      }
      for (const img of r.images || []) console.log("   " + c.accent(img));
    });

    if (settings.generateImages && provider.tier !== "api") {
      say(
        "info",
        c.muted(
          `Provider "${provider.id}" is copy-only (no image API) — printed the ${provider.label} prompt.`,
        ),
      );
    }
    if (prompts.length > 1 || settings.generateImages) {
      console.log(
        c.muted(`\nseed ${seed}  ·  provider ${provider.id}  ·  reproduce with --seed ${seed}`),
      );
    }
  });
}
