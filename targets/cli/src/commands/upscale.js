/**
 * @file
 * @brief The `upscale` command — AI-upscale an image in the output folder via a provider's upscale
 * path (the same one the GUI's single-view Upscale action uses). The result is saved back into the
 * shared `output/` folder.
 */
import { c, say } from "../lib/colors.js";
import { printJson } from "../lib/format.js";
import { upscaleImage } from "../lib/imagegen.js";
import { allProviders } from "../lib/providers.js";
import { startBackend, stopBackend } from "../lib/backend.js";

/**
 * Register the `upscale` command.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerUpscale(program) {
  program
    .command("upscale <image>")
    .description("AI-upscale a saved image (a /api/output/<file> path, a filename, or a data: URL)")
    .requiredOption("-p, --provider <id>", "Upscale provider id (see: prompt list providers)")
    .action(async (image, opts, command) => {
      const json = command.optsWithGlobals().json;
      const provider = (await allProviders()).find((p) => p.id === opts.provider);
      if (!provider) {
        say("err", `Unknown provider "${opts.provider}". See: prompt list providers`);
        process.exitCode = 1;
        return;
      }
      if (!provider.loadUpscale && !provider.capabilities?.upscale) {
        say(
          "warn",
          `"${opts.provider}" may not support upscaling — attempting via the proxy anyway.`,
        );
      }
      await startBackend();
      try {
        const saved = await upscaleImage({ providerId: opts.provider, image });
        if (json) return printJson({ provider: opts.provider, images: saved });
        if (!saved.length) say("warn", "Upscale produced no image.");
        else {
          say("ok", "Upscaled:");
          for (const p of saved) console.log("   " + c.accent(p));
        }
      } catch (e) {
        say("err", e.message || String(e));
        process.exitCode = 1;
      } finally {
        await stopBackend();
      }
    });
}
