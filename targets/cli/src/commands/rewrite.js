/**
 * @file
 * @brief The `rewrite` command — run the GUI's auto-fix prompt rewrite (prose clean-up or
 * keyword/tag-list translation) through a text provider, standalone. Handy for polishing a prompt
 * without generating an image.
 */
import { c, say } from "../lib/colors.js";
import { printJson } from "../lib/format.js";
import { rewritePrompt } from "../lib/rewrite.js";
import { getKey } from "../lib/keys.js";
import { getProvider, rewriteProviders } from "../lib/providers.js";
import { effectiveSettings } from "../lib/settings.js";
import { startBackend, stopBackend } from "../lib/backend.js";

/**
 * Register the `rewrite` command.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerRewrite(program) {
  program
    .command("rewrite <prompt>")
    .description("Rewrite a prompt with a text provider (auto-fix / keyword-translate)")
    .option("-p, --provider <id>", "Rewrite (text) provider id (default: saved rewriteProvider)")
    .option("--keyword", "Keyword/tag-list rewrite (default: prose clean-up)")
    .action(async (prompt, opts, command) => {
      const json = command.optsWithGlobals().json;
      const settings = effectiveSettings();
      const providerId = opts.provider || settings.rewriteProvider;
      if (!providerId || providerId === "none") {
        const choices = (await rewriteProviders()).map((p) => p.id).join(", ");
        say("err", `No rewrite provider. Pass -p <id> or set one. Options: ${choices}`);
        process.exitCode = 1;
        return;
      }
      const provider = await getProvider(providerId);
      if (!provider || !(provider.loadRewrite || provider.rewrite)) {
        say("err", `"${providerId}" can't rewrite prompts. See: prompt list providers`);
        process.exitCode = 1;
        return;
      }
      const key = getKey(providerId);
      if (!key) {
        say(
          "err",
          `Provider "${providerId}" needs an API key. Set one with: prompt keys set ${providerId} <key>`,
        );
        process.exitCode = 1;
        return;
      }
      const needBackend = provider.transport !== "browser-direct";
      if (needBackend) await startBackend();
      try {
        const text = await rewritePrompt({
          providerId,
          prompt,
          key,
          mode: opts.keyword ? "keyword" : undefined,
        });
        if (json) printJson({ provider: providerId, mode: opts.keyword ? "keyword" : "fix", text });
        else console.log(c.value(text));
      } catch (e) {
        say("err", e.message || String(e));
        process.exitCode = 1;
      } finally {
        if (needBackend) await stopBackend();
      }
    });
}
