/**
 * @file
 * @brief CLI program assembly. Builds the `rap` commander program, wires global options (color,
 * JSON) and every subcommand, and makes `generate` the default so `rap "a cat"` just works. Kept a
 * thin coordinator — each command lives in its own file under `commands/`.
 */
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setColorEnabled, c } from "./lib/colors.js";
import { pinCwdToRepoRoot } from "./lib/paths.js";
import registerGenerate from "./commands/generate.js";
import registerList from "./commands/list.js";
import registerConfig from "./commands/config.js";
import registerKeys from "./commands/keys.js";
import registerRewrite from "./commands/rewrite.js";
import registerUpscale from "./commands/upscale.js";
import registerCompletion from "./commands/completion.js";

/** @returns {string} The CLI version (from this package's package.json). */
function version() {
  try {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Build the full commander program.
 * @returns {import("commander").Command} The configured program.
 */
export function buildProgram() {
  const program = new Command();
  program
    .name("rap")
    .description(
      `${c.heading("random-ai-prompt")} — generate rich AI image/text prompts and run them through image providers.\n` +
        "Uses the same engine + providers as the web/desktop app. Prompt generation needs nothing; image\n" +
        "generation uses a local Stable Diffusion WebUI or a BYOK provider (see: rap list providers).",
    )
    .version(version(), "-v, --version", "Print the CLI version")
    .option("--json", "Machine-readable JSON output")
    .option("--no-color", "Disable colored output")
    .option("--color", "Force colored output")
    .configureHelp({ sortSubcommands: true })
    .showSuggestionAfterError(true);

  // Apply the color choice before anything prints.
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.color === false) setColorEnabled(false);
    else if (opts.color === true) setColorEnabled(true);
  });

  registerGenerate(program);
  registerList(program);
  registerConfig(program);
  registerKeys(program);
  registerRewrite(program);
  registerUpscale(program);
  registerCompletion(program);

  program.addHelpText(
    "after",
    `\n${c.subhead("Examples:")}\n` +
      `  ${c.muted("$")} rap "a {#animal} in a {biome}"        generate one prompt from a template\n` +
      `  ${c.muted("$")} rap --prompts 5 --nsfw                five prompts, adult content enabled\n` +
      `  ${c.muted("$")} rap -p forge --images "a castle"      generate an image via local Forge WebUI\n` +
      `  ${c.muted("$")} rap list blocks                       browse every building block\n` +
      `  ${c.muted("$")} rap keys set openai sk-...            store a provider API key\n` +
      `  ${c.muted("$")} rap completion zsh > _rap             install shell completion\n`,
  );

  return program;
}

/**
 * Parse + run the CLI.
 * @param {string[]} argv `process.argv`.
 * @returns {Promise<void>}
 */
export async function run(argv) {
  pinCwdToRepoRoot();
  const program = buildProgram();
  // Honor color/no-color even for pure help/errors (before any action hook runs).
  if (argv.includes("--no-color")) setColorEnabled(false);
  else if (argv.includes("--color")) setColorEnabled(true);
  await program.parseAsync(argv);
}
