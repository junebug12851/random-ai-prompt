/**
 * @file
 * @brief Shell-completion script generators (bash, zsh, fish, PowerShell) plus the dynamic-value
 * resolver behind the hidden `prompt __complete` command. Scripts are generated from the same flag spec
 * the parser uses, so completion never drifts from the real options. Dynamic values (provider ids,
 * preset names, samplers, block/list names, …) are fetched live by calling `prompt __complete <kind>`,
 * kubectl/gh-style — so completion reflects the user's actual catalog and installed providers.
 */
import { ALL_FLAGS } from "./optionSpec.js";
import { allProviders, rewriteProviders, DIALECTS } from "./providers.js";
import { presetNames } from "./presets.js";
import { blockTokens, pickerLists } from "./engine.js";
import fs from "node:fs";
import path from "node:path";
import { WEB_ROOT } from "./paths.js";

/** Top-level subcommands (canonical names). */
export const COMMANDS = [
  "generate",
  "list",
  "config",
  "keys",
  "rewrite",
  "upscale",
  "completion",
  "help",
];

/** The long flags for `generate` (every generation flag + the command's own switches + globals). */
export function generateFlags() {
  const spec = ALL_FLAGS.map((f) => f.flag.split(" ")[0]);
  const own = [
    "--provider",
    "-p",
    "--images",
    "--no-images",
    "--preset",
    "--seed",
    "--random",
    "--nsfw",
    "--no-gui-share",
    "--json",
    "--color",
    "--no-color",
  ];
  return [...new Set([...spec, ...own])];
}

/**
 * Resolve dynamic completion candidates for a kind (used by `prompt __complete <kind>`).
 * @param {string} kind The candidate kind.
 * @returns {Promise<string[]>} The candidate strings.
 */
export async function complete(kind) {
  switch (kind) {
    case "commands":
      return COMMANDS;
    case "providers":
      return (await allProviders()).map((p) => p.id);
    case "rewrite-providers":
      return (await rewriteProviders()).map((p) => p.id);
    case "presets":
      return presetNames();
    case "modes":
      return ["StableDiffusion", "NovelAI", "Midjourney", "Plain"];
    case "dialects":
      return Object.keys(DIALECTS);
    case "shells":
      return ["bash", "zsh", "fish", "powershell"];
    case "list-what":
      return ["blocks", "lists", "providers", "presets", "dialects", "samplers", "settings"];
    case "samplers":
      try {
        return JSON.parse(
          fs.readFileSync(
            path.join(WEB_ROOT, "shared", "local-webui", "data", "samplers.json"),
            "utf8",
          ),
        );
      } catch {
        return [];
      }
    case "blocks":
      return blockTokens();
    case "lists":
      return pickerLists();
    default:
      return [];
  }
}

/**
 * The bash completion script.
 * @returns {string} The script text.
 */
export function bashScript() {
  return `# bash completion for prompt — install: prompt completion bash > /etc/bash_completion.d/prompt
#                          or: prompt completion bash >> ~/.bashrc  (then re-source)
_prompt_complete() {
  local cur prev words cword
  _init_completion 2>/dev/null || { cur="\${COMP_WORDS[COMP_CWORD]}"; prev="\${COMP_WORDS[COMP_CWORD-1]}"; }
  case "$prev" in
    -p|--provider) COMPREPLY=( $(compgen -W "$(prompt __complete providers 2>/dev/null)" -- "$cur") ); return;;
    --rewrite-provider) COMPREPLY=( $(compgen -W "$(prompt __complete rewrite-providers 2>/dev/null)" -- "$cur") ); return;;
    --preset) COMPREPLY=( $(compgen -W "$(prompt __complete presets 2>/dev/null)" -- "$cur") ); return;;
    --sampler) COMPREPLY=( $(compgen -W "$(prompt __complete samplers 2>/dev/null)" -- "$cur") ); return;;
    --mode) COMPREPLY=( $(compgen -W "$(prompt __complete modes 2>/dev/null)" -- "$cur") ); return;;
    completion) COMPREPLY=( $(compgen -W "$(prompt __complete shells 2>/dev/null)" -- "$cur") ); return;;
    list|ls) COMPREPLY=( $(compgen -W "$(prompt __complete list-what 2>/dev/null)" -- "$cur") ); return;;
  esac
  if [[ "$cur" == -* ]]; then
    COMPREPLY=( $(compgen -W "${generateFlags().join(" ")}" -- "$cur") )
  else
    COMPREPLY=( $(compgen -W "${COMMANDS.join(" ")}" -- "$cur") )
  fi
}
complete -F _prompt_complete prompt
`;
}

/**
 * The zsh completion script.
 * @returns {string} The script text.
 */
export function zshScript() {
  return `#compdef prompt
# zsh completion for prompt — install: prompt completion zsh > "\${fpath[1]}/_prompt"  (then restart zsh)
_prompt() {
  local -a cmds flags
  cmds=(${COMMANDS.map((c) => `'${c}'`).join(" ")})
  flags=(${generateFlags()
    .map((f) => `'${f}'`)
    .join(" ")})
  local prev=\${words[CURRENT-1]}
  case "$prev" in
    -p|--provider) compadd -- \${(f)"$(prompt __complete providers 2>/dev/null)"}; return;;
    --rewrite-provider) compadd -- \${(f)"$(prompt __complete rewrite-providers 2>/dev/null)"}; return;;
    --preset) compadd -- \${(f)"$(prompt __complete presets 2>/dev/null)"}; return;;
    --sampler) compadd -- \${(f)"$(prompt __complete samplers 2>/dev/null)"}; return;;
    --mode) compadd -- \${(f)"$(prompt __complete modes 2>/dev/null)"}; return;;
    completion) compadd -- \${(f)"$(prompt __complete shells 2>/dev/null)"}; return;;
    list|ls) compadd -- \${(f)"$(prompt __complete list-what 2>/dev/null)"}; return;;
  esac
  if [[ "\${words[CURRENT]}" == -* ]]; then
    compadd -- $flags
  else
    compadd -- $cmds $flags
  fi
}
compdef _prompt prompt
`;
}

/**
 * The fish completion script.
 * @returns {string} The script text.
 */
export function fishScript() {
  const lines = [
    "# fish completion for prompt — install: prompt completion fish > ~/.config/fish/completions/prompt.fish",
    "function __prompt_needs_command",
    "    set -l cmd (commandline -opc)",
    "    test (count $cmd) -eq 1",
    "end",
    `complete -c prompt -n __prompt_needs_command -f -a "${COMMANDS.join(" ")}"`,
    "complete -c prompt -n '__fish_seen_subcommand_from completion' -f -a \"(prompt __complete shells)\"",
    "complete -c prompt -n '__fish_seen_subcommand_from list ls' -f -a \"(prompt __complete list-what)\"",
    'complete -c prompt -s p -l provider -x -a "(prompt __complete providers)"',
    'complete -c prompt -l rewrite-provider -x -a "(prompt __complete rewrite-providers)"',
    'complete -c prompt -l preset -x -a "(prompt __complete presets)"',
    'complete -c prompt -l sampler -x -a "(prompt __complete samplers)"',
    'complete -c prompt -l mode -x -a "(prompt __complete modes)"',
  ];
  for (const f of ALL_FLAGS) {
    const long = f.flag.split(" ")[0].replace(/^--/, "");
    lines.push(`complete -c prompt -l ${long} -d ${JSON.stringify(f.desc)}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * The PowerShell completion script.
 * @returns {string} The script text.
 */
export function pwshScript() {
  return `# PowerShell completion for prompt — install: prompt completion powershell | Out-String | Invoke-Expression
#   (persist by adding that line to $PROFILE)
Register-ArgumentCompleter -Native -CommandName prompt -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $elements = $commandAst.CommandElements
  $prev = if ($elements.Count -ge 2) { $elements[$elements.Count - 2].ToString() } else { '' }
  $dyn = @{
    '-p' = 'providers'; '--provider' = 'providers'; '--rewrite-provider' = 'rewrite-providers';
    '--preset' = 'presets'; '--sampler' = 'samplers'; '--mode' = 'modes'; 'completion' = 'shells';
    'list' = 'list-what'; 'ls' = 'list-what'
  }
  if ($dyn.ContainsKey($prev)) {
    (prompt __complete $dyn[$prev] 2>$null) -split "\`n" | Where-Object { $_ -like "$wordToComplete*" } |
      ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
    return
  }
  $cmds = @(${COMMANDS.map((c) => `'${c}'`).join(", ")})
  $flags = @(${generateFlags()
    .map((f) => `'${f}'`)
    .join(", ")})
  $pool = if ($wordToComplete -like '-*') { $flags } else { $cmds + $flags }
  $pool | Where-Object { $_ -like "$wordToComplete*" } |
    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`;
}

/**
 * The completion script for a shell.
 * @param {string} shell One of bash | zsh | fish | powershell (pwsh).
 * @returns {string|null} The script text, or null for an unknown shell.
 */
export function scriptFor(shell) {
  switch (String(shell).toLowerCase()) {
    case "bash":
      return bashScript();
    case "zsh":
      return zshScript();
    case "fish":
      return fishScript();
    case "powershell":
    case "pwsh":
      return pwshScript();
    default:
      return null;
  }
}
