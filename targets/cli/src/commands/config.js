/**
 * @file
 * @brief The `config` command — read/write the CLI's persisted defaults. Stored in the CLI's own
 * `user/settings/cli.json` namespace (never clobbers the GUI's `settings.json`), so a value set here
 * becomes the default for every `prompt generate` while the GUI keeps its own. Keys are the same
 * `settings` keys the flags map to (see `prompt generate --help`), coerced by the matching flag's type.
 */
import path from "node:path";
import { c, say } from "../lib/colors.js";
import { printJson, table } from "../lib/format.js";
import { readConfig, writeConfig } from "../lib/settings.js";
import { ALL_FLAGS, coerce } from "../lib/optionSpec.js";
import { USER_SETTINGS_DIR } from "../lib/paths.js";

const byKey = new Map(ALL_FLAGS.map((f) => [f.key, f]));

/**
 * Register the `config` command.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerConfig(program) {
  const config = program.command("config").description("Read/write persisted CLI defaults");

  config
    .command("list", { isDefault: true })
    .description("Show the persisted CLI config")
    .action((_opts, command) => {
      const cfg = stripKeys(readConfig());
      if (command.optsWithGlobals().json) return printJson(cfg);
      const rows = Object.entries(cfg).map(([k, v]) => [c.key(k), c.value(String(v))]);
      if (!rows.length) {
        say(
          "info",
          c.muted("No CLI config set yet. Set one with: prompt config set <key> <value>"),
        );
        return;
      }
      console.log(c.heading("CLI config"));
      console.log(table(rows, { indent: 2 }));
    });

  config
    .command("get <key>")
    .description("Print one config value")
    .action((key, _opts, command) => {
      const cfg = readConfig();
      const val = cfg[key];
      if (command.optsWithGlobals().json) return printJson({ [key]: val ?? null });
      if (val === undefined) say("warn", `"${key}" is not set.`);
      else console.log(String(val));
    });

  config
    .command("set <key> <value>")
    .description("Set a config value (coerced to the setting's type)")
    .action((key, value) => {
      const spec = byKey.get(key);
      let coerced = value;
      if (spec) {
        try {
          coerced = coerce(value, spec.type);
        } catch (e) {
          say("err", `${key}: ${e.message}`);
          process.exitCode = 1;
          return;
        }
      } else {
        say(
          "warn",
          `"${key}" isn't a known setting key — storing as a string. (See: prompt generate --help)`,
        );
      }
      const cfg = readConfig();
      cfg[key] = coerced;
      writeConfig(cfg);
      say("ok", `${c.key(key)} = ${c.value(String(coerced))}`);
    });

  config
    .command("unset <key>")
    .description("Remove a config value")
    .action((key) => {
      const cfg = readConfig();
      if (!(key in cfg)) {
        say("warn", `"${key}" is not set.`);
        return;
      }
      delete cfg[key];
      writeConfig(cfg);
      say("ok", `Removed ${c.key(key)}`);
    });

  config
    .command("path")
    .description("Print the config file location")
    .action(() => console.log(path.join(USER_SETTINGS_DIR, "cli.json")));
}

/**
 * A config blob without the secret `keys` map (keys are managed by `prompt keys`).
 * @param {object} cfg The config.
 * @returns {object} The config without `keys`.
 */
function stripKeys(cfg) {
  const { keys: _drop, ...rest } = cfg || {};
  return rest;
}
