/**
 * @file
 * @brief The `completion` command (emit a shell completion script) and the hidden `__complete`
 * command (dynamic value resolver the generated scripts call). Supports bash, zsh, fish, and
 * PowerShell.
 */
import { say, c } from "../lib/colors.js";
import { scriptFor, complete } from "../lib/completion.js";

/**
 * Register the `completion` + hidden `__complete` commands.
 * @param {import("commander").Command} program The program.
 * @returns {void}
 */
export default function registerCompletion(program) {
  program
    .command("completion [shell]")
    .description("Print a shell completion script (bash | zsh | fish | powershell)")
    .addHelpText(
      "after",
      `\n${c.subhead("Install:")}\n` +
        `  ${c.muted("bash")}        rap completion bash   > /etc/bash_completion.d/rap\n` +
        `  ${c.muted("zsh")}         rap completion zsh    > "\${fpath[1]}/_rap"\n` +
        `  ${c.muted("fish")}        rap completion fish   > ~/.config/fish/completions/rap.fish\n` +
        `  ${c.muted("powershell")}  rap completion powershell | Out-String | Invoke-Expression\n`,
    )
    .action((shell) => {
      if (!shell) {
        say("err", "Specify a shell: bash | zsh | fish | powershell");
        process.exitCode = 1;
        return;
      }
      const script = scriptFor(shell);
      if (!script) {
        say("err", `Unsupported shell "${shell}". Choose: bash | zsh | fish | powershell`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(script);
    });

  // Hidden dynamic-completion resolver used by the generated scripts. Prints newline-separated
  // candidates for a kind (providers, presets, samplers, blocks, …). Kept fast + quiet.
  program
    .command("__complete <kind>", { hidden: true })
    .description("Internal: emit dynamic completion candidates")
    .action(async (kind) => {
      try {
        const items = await complete(kind);
        if (items && items.length) process.stdout.write(items.join("\n") + "\n");
      } catch {
        // completion must never error the shell — emit nothing
      }
    });
}
