# `rap` — random-ai-prompt CLI

The command-line target for [random-ai-prompt](../../README.md). Generate rich AI image/text prompts
and run them through image providers — using the **same engine, providers, and settings the web/desktop
app uses**. Traditional args + flags, a `--help` page, colored output, and shell completion for
bash/zsh/fish/PowerShell. No TUI, no interactive prompts.

## Install / run

From the repo root (Node 24+):

```bash
npm install            # installs the CLI too (root postinstall)
npm run cli -- --help  # or: node targets/cli/bin/rap.js --help
```

To get a global `rap` command, link it once: `npm link` inside `targets/cli/` (or add
`targets/cli/bin/rap.js` to your PATH).

## Quick start

```bash
rap "a {#animal} in a {biome}"          # one prompt from a template (DPL)
rap --prompts 5                          # five prompts
rap --prompts 5 --nsfw                    # include adult content
rap -p forge --images "a castle at dusk"  # generate an image via a local Forge/A1111 WebUI
rap -p openai --images "a fox" --width 1024 --height 1024   # BYOK hosted provider
rap --seed 12345 --prompts 4              # reproducible batch (re-run to reproduce)
```

Prompt generation needs nothing. Image generation needs either a local Stable Diffusion WebUI
(ComfyUI / A1111 / Forge / SD.Next) or a BYOK provider key. Images save to the shared `output/` folder
with the same metadata sidecar the app's gallery reads.

## Commands

| Command | What it does |
|---------|--------------|
| `rap [prompt]` / `rap generate` | Generate prompts (and images with `--images -p <id>`). Every engine setting is a flag — see `rap generate --help`. |
| `rap list <what> [filter]` | Browse `blocks`, `lists`, `providers`, `presets`, `dialects`, `samplers`, or the effective `settings`. |
| `rap config <get\|set\|unset\|list\|path>` | Read/write persisted CLI defaults. |
| `rap keys <set\|get\|remove\|list>` | Manage BYOK provider keys (stored on-device; shared with the app). |
| `rap rewrite <prompt> [--keyword]` | Auto-fix / keyword-translate a prompt via a text provider. |
| `rap upscale <image> -p <id>` | AI-upscale a saved image. |
| `rap completion <shell>` | Print a completion script (bash \| zsh \| fish \| powershell). |

Add `--json` to any command for machine-readable output. `--no-color` / `--color` override color
auto-detection (also honors `NO_COLOR` / `FORCE_COLOR`).

## Shell completion

```bash
rap completion bash   > /etc/bash_completion.d/rap
rap completion zsh    > "${fpath[1]}/_rap"
rap completion fish   > ~/.config/fish/completions/rap.fish
rap completion powershell | Out-String | Invoke-Expression   # add to $PROFILE to persist
```

Completion offers subcommands, flags, and **live** values (provider ids, preset names, samplers, …)
pulled from your actual catalog.

## Keys & privacy

BYOK API keys are stored on-device only (in `user/settings/`, shared with the desktop/web app) and are
never printed in full or sent anywhere except per-request to the provider you choose. A key can also be
supplied for one run via an env var (`RAP_KEY_<PROVIDERID>`) without persisting it.

See [`notes/systems/cli.md`](../../notes/systems/cli.md) for the design and internals.
