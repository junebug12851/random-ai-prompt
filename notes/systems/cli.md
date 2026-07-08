# The CLI target — `targets/cli/` (`prompt`)

The **command-line target**: a traditional args-and-flags CLI (`prompt`) that generates AI image/text
prompts and runs them through the image providers — **the same engine, providers, settings, and
on-disk store the web/desktop app uses**. No TUI, no interactive mode: everything is a subcommand with
flags and a `--help` page, plus colored output and shell completion for bash/zsh/fish/PowerShell.

It is a **build target** (like `targets/web/`), its own npm package under `targets/cli/`, added
2026-07-07 (2.50.0). It replaces the removed pre-revival CommonJS CLI (see [History](#history)).

## Design rule: parity with the engine AND the GUI

The CLI must stay at **feature parity with both the engine and the GUI, by default.** It never forks
prompt or provider logic — it reuses:

- **The engine** — `createEngine(nodeLoader)` + `promptFilesAndSuggestions` (the exact bootstrap the
  smoke test uses). Every field in `engine/settings.js` is exposed as a flag (`src/lib/optionSpec.js`).
- **The providers** — the adapters under `targets/web/shared/` are run **verbatim**. A Node-side
  registry (`src/lib/providers.js`) replaces the SPA's Vite-glob registry (`shared/index.js`, which
  can't run under plain Node): it fs-discovers each `shared/<id>/config.js` and each
  `_shared/settings/*.js` and dynamic-imports them, folding shared settings in exactly like the web
  registry.
- **The settings + keys store** — the same per-namespace files under `user/settings/`
  (`src/lib/store.js` → `targets/web/backend/vite-api-helpers.js`). CLI defaults persist to their own
  `cli` namespace (never clobbering the GUI's `settings.json`), while BYOK keys are **shared**: read
  from both stores, so a key saved in the desktop app works in the CLI and vice-versa.

When a new engine setting or GUI feature lands, the matching CLI flag/command is added in the same
change. See the memory/standing note in `CLAUDE.md`.

## How image generation reaches full parity headlessly

The provider adapters are written for the browser talking to the local backend: hosted providers POST
`/api/generate`, local engines (ComfyUI / A1111 / Forge / SD.Next) go through `/api/forward`, images
are saved via `/api/image`. Rather than reimplement any of that, the CLI **runs the real backend
in-process** and shims `fetch`:

- `src/lib/backend.js` starts `createApiHandler()` (from `targets/web/backend/apiHandler.js`) on an
  http server bound to an **ephemeral localhost port**, then wraps `globalThis.fetch` so a
  root-relative URL (`/api/...`) resolves to that server; absolute URLs (the providers' direct API
  calls) pass through untouched. On teardown it restores `fetch` and closes the server.
- So every provider's own `code/generate.js` runs unchanged, and images land in the **same `output/`
  folder with the same `.json` sidecar** the GUI gallery reads (`src/lib/imagegen.js` mirrors the
  SPA's `useImageBatches.runBatch`: rewrite passes → negative roll → provider generate → ingest).

An `api`-tier provider is only ever called when the user passes `--images`, so `prompt -p openai "x"`
without `--images` never spends credits — it just prints the prompt. Copy-only providers
(`plain`/`novelai`/`midjourney`) never hit the network; they format the prompt in their dialect.

### The JSON-import hook

The shared provider files use bare JSON imports (`import x from "./x.json"`) that Vite normally
transforms; Node 24 rejects them without a `type: json` attribute. `bin/prompt.js` registers an ESM
resolve hook (`src/lib/jsonLoader.mjs`) that injects the attribute, so the provider code loads
unmodified. (Under Vitest the transform handles JSON, so tests don't need the hook.)

## Layout

| Path | Role |
|------|------|
| `bin/prompt.js` | Entry shim — registers the JSON hook, then runs `src/main.js`. |
| `src/main.js` | Builds the commander program, global flags (`--json`, `--color/--no-color`), wires subcommands. |
| `src/commands/` | One file per command: `generate` (default), `list`, `config`, `keys`, `rewrite`, `upscale`, `completion`. |
| `src/lib/optionSpec.js` | Single source of truth for every generation flag (engine + image + rewrite) → coercion + overrides + completion. |
| `src/lib/engine.js` / `promptRun.js` | Node engine bootstrap + a thin binding of the shared, engine-owned prompt-run (`engine/promptRun.js`) — the seed/reroll logic shared with the SPA + the backend. |
| `src/lib/providers.js` | Node provider registry (fs-discover + dynamic import). |
| `src/lib/imagegen.js` | Per-prompt provider orchestration + upscale (mirrors `useImageBatches`). |
| `src/lib/settings.js` / `presets.js` / `keys.js` / `store.js` | Settings merge, preset loading, BYOK keys, the shared file store. |
| `src/lib/backend.js` | In-process backend + `fetch` shim. |
| `src/lib/completion.js` | bash/zsh/fish/PowerShell script generators + the `prompt __complete` dynamic resolver. |
| `src/lib/colors.js` / `format.js` | picocolors styling (honors `NO_COLOR`/`FORCE_COLOR`) + tables/JSON output. |

## Commands (quick reference)

- `prompt [prompt]` / `prompt generate` — generate prompts; `--images -p <id>` to also generate images. Every
  `engine/settings.js` field is a flag (`prompt generate --help`); plus `--provider`, `--preset`, `--seed`,
  `--random`, `--nsfw`, image knobs (`--width/--height/--steps/--cfg/--sampler/--model/--size/--negative`),
  and `--rewrite-provider/--auto-fix/--auto-keyword`. `--json` for machine output.
- `prompt list <blocks|lists|providers|presets|dialects|samplers|settings> [filter]` — browse the catalog.
- `prompt config <get|set|unset|list|path>` — persisted CLI defaults (`cli` namespace).
- `prompt keys <set|get|remove|list>` — BYOK keys (on-device; `--shared` to also write the GUI store).
- `prompt rewrite <prompt> [-p id] [--keyword]` — standalone auto-fix / keyword rewrite.
- `prompt upscale <image> -p <id>` — AI-upscale a saved image.
- `prompt completion <bash|zsh|fish|powershell>` — print a completion script.

## Completion

`src/lib/completion.js` generates a script per shell from the same flag spec the parser uses (so it
never drifts), and a hidden `prompt __complete <kind>` command resolves dynamic values live (provider
ids, preset names, samplers, block/list names, …) — kubectl/gh-style, so completion reflects the
user's actual catalog and installed providers.

## Verification

CLI unit tests live in [`tests/cli/cli.test.js`](../../tests/cli/cli.test.js) (run by the root Vitest
gate): flag coercion + overrides, the settings/preset merge, provider-registry discovery, the
completion generators, key masking, and reproducible prompt generation. They're network-free — image
generation / the in-process backend / provider API calls need a running SD server or BYOK keys and are
verified manually. The CLI is also covered by root `eslint` + `prettier` (it's Node ESM, linted with
the engine).

## History

The pre-revival (2022–2023) CommonJS CLI (`index.js` + `common.js` + `src/` + `helpers/`, yargs 18, a
progress server on port 7862, variation/reroll/animation run modes) was **removed** from the tree on
2026-07-02; it survives in git history and as a reference clone under `assets/references/`. The current
CLI is a clean build target that reuses the isomorphic engine instead of owning its own copy.
