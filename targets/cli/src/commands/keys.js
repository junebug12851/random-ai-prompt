/**
 * @file
 * @brief The `keys` command — manage BYOK provider API keys. Keys are stored on-device only (in the
 * CLI's `cli.json` store) and are shared with the desktop/web app (read from its `settings.json` too).
 * They are never printed in full and never leave the machine except per-request to the chosen
 * provider — the same handling the GUI's legal docs describe.
 */
import { c, say } from "../lib/colors.js";
import { printJson, table } from "../lib/format.js";
import { getKey, setKey, removeKey, listKeys, mask } from "../lib/keys.js";
import { getProvider } from "../lib/providers.js";

/**
 * Register the `keys` command.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerKeys(program) {
  const keys = program
    .command("keys")
    .description("Manage BYOK provider API keys (stored on-device)");

  keys
    .command("list", { isDefault: true })
    .description("List providers that have a stored key (masked)")
    .action((_opts, command) => {
      const found = listKeys();
      if (command.optsWithGlobals().json) return printJson(found);
      if (!found.length) {
        say("info", c.muted("No keys stored. Add one with: prompt keys set <provider> <key>"));
        return;
      }
      console.log(c.heading("Stored API keys"));
      console.log(
        table(
          found.map((k) => [c.key(k.id), c.muted(k.source), k.masked]),
          { head: ["provider", "from", "key"], indent: 2 },
        ),
      );
    });

  keys
    .command("set <provider> <key>")
    .description("Store a provider API key")
    .option("--shared", "Also write into the GUI's settings (shared)")
    .action(async (provider, key, opts) => {
      if (!(await getProvider(provider))) {
        say(
          "warn",
          `"${provider}" isn't a known provider id, but storing the key anyway. (See: prompt list providers)`,
        );
      }
      setKey(provider, key, !!opts.shared);
      say(
        "ok",
        `Stored key for ${c.key(provider)} (${mask(key)})${opts.shared ? " — shared with the app" : ""}`,
      );
    });

  keys
    .command("get <provider>")
    .description("Print a provider's stored key (full value)")
    .action((provider, _opts, command) => {
      const val = getKey(provider);
      if (command.optsWithGlobals().json) return printJson({ provider, key: val || null });
      if (!val) {
        say("warn", `No key stored for "${provider}".`);
        return;
      }
      console.log(val);
    });

  keys
    .command("remove <provider>")
    .alias("rm")
    .description("Remove a stored provider key")
    .option("--shared", "Also remove from the GUI's settings")
    .action((provider, opts) => {
      removeKey(provider, !!opts.shared);
      say("ok", `Removed key for ${c.key(provider)}`);
    });
}
