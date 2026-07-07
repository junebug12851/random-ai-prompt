# `prompt` — random-ai-prompt CLI

The command-line target for [random-ai-prompt](../../README.md). Generate rich AI image/text prompts
and run them through image providers — using the **same engine, providers, and settings the web/desktop
app uses**. Traditional args + flags, a `--help` page, colored output, and shell completion for
bash/zsh/fish/PowerShell. No TUI, no interactive prompts.

## Install / run

From the repo root (Node 24+):

```bash
npm install            # installs the CLI too (root postinstall)
npm run cli -- --help  # or: node targets/cli/bin/prompt.js --help
```

To get a global `prompt` command, link it once: `npm link` inside `targets/cli/` (or add
`targets/cli/bin/prompt.js` to your PATH).

## Quick start

```bash
prompt "a {#animal} in a {biome}"          # one prompt from a template (DPL)
prompt --prompts 5                          # five prompts
prompt --prompts 5 --nsfw                    # include adult content
prompt -p forge --images "a castle at dusk"  # generate an image via a local Forge/A1111 WebUI
prompt -p openai --images "a fox" --width 1024 --height 1024   # BYOK hosted provider
prompt --seed 12345 --prompts 4              # reproducible batch (re-run to reproduce)
```

Prompt generation needs nothing. Image generation needs either a local Stable Diffusion WebUI
(ComfyUI / A1111 / Forge / SD.Next) or a BYOK provider key. Images save to the shared `output/` folder
with the same metadata sidecar the app's gallery reads.

## Commands

| Command | What it does |
|---------|--------------|
| `prompt [prompt]` / `prompt generate` | Generate prompts (and images with `--images -p <id>`). Every engine setting is a flag — see `prompt generate --help`. |
| `prompt list <what> [filter]` | Browse `blocks`, `lists`, `providers`, `presets`, `dialects`, `samplers`, or the effective `settings`. |
| `prompt config <get\|set\|unset\|list\|path>` | Read/write persisted CLI defaults. |
| `prompt keys <set\|get\|remove\|list>` | Manage BYOK provider keys (stored on-device; shared with the app). |
| `prompt rewrite <prompt> [--keyword]` | Auto-fix / keyword-translate a prompt via a text provider. |
| `prompt upscale <image> -p <id>` | AI-upscale a saved image. |
| `prompt completion <shell>` | Print a completion script (bash \| zsh \| fish \| powershell). |

Add `--json` to any command for machine-readable output. `--no-color` / `--color` override color
auto-detection (also honors `NO_COLOR` / `FORCE_COLOR`).

## Shell completion

```bash
prompt completion bash   > /etc/bash_completion.d/prompt
prompt completion zsh    > "${fpath[1]}/_prompt"
prompt completion fish   > ~/.config/fish/completions/prompt.fish
prompt completion powershell | Out-String | Invoke-Expression   # add to $PROFILE to persist
```

Completion offers subcommands, flags, and **live** values (provider ids, preset names, samplers, …)
pulled from your actual catalog.

## Keys & privacy

BYOK API keys are stored on-device only (in `user/settings/`, shared with the desktop/web app) and are
never printed in full or sent anywhere except per-request to the provider you choose. A key can also be
supplied for one run via an env var (`PROMPT_KEY_<PROVIDERID>`) without persisting it.

See [`notes/systems/cli.md`](../../notes/systems/cli.md) for the design and internals.
