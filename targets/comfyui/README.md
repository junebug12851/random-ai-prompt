# Random AI Prompt — ComfyUI nodes

Bring the [Random AI Prompt](https://github.com/junebug12851/random-ai-prompt) engine into ComfyUI: the
DPL processor, blocks, lists, and presets, as **natural-language-first prompt sources** you wire into a
`CLIP Text Encode`. No power-user syntax required — type plain English (with optional `{#block}` /
`{list}` tokens) and get a richer prompt than you'd write by hand.

This is a **build target** of the main project (`targets/comfyui/`). It's **prompt-side only** — ComfyUI
already owns image generation, upscaling, variations, and re-roll (its native seed widget), so this
plugin focuses on the one thing it adds: the prompt engine.

## How it works

The nodes are thin wrappers. All prompt/engine logic runs in the project's **shared engine** behind a
running Random AI Prompt app's local backend — the nodes just make HTTP calls to it (see `client.py`).
So it needs **no Python dependencies** (standard library only) and never re-implements engine logic.

**Point it at your running app.** Start the Random AI Prompt **desktop app** (or `npm start` from the
repo), which serves the backend on `http://127.0.0.1:4173` by default. Override the URL — this applies to
**both the dropdowns and generation** — via, in precedence order:

1. the optional `server_url` widget on any node (per-node override), then
2. **Settings → "Random AI Prompt — app URL"** in ComfyUI (persisted; the usual way), then
3. the `RANDOM_AI_PROMPT_URL` environment variable, then
4. the default `http://127.0.0.1:4173`.

> Running the **dev server** (`npm run web`) instead of the desktop build? It serves on **`:5173`**, so
> set the Settings field (or `server_url`) to `http://localhost:5173`.

If the app isn't running, the nodes still load; the dropdowns fill in and generation works as soon as
it's reachable.

## Install

Copy (or symlink) this folder into your ComfyUI `custom_nodes/` as `ComfyUI-RandomAIPrompt`, then
restart ComfyUI:

```
cp -r targets/comfyui  /path/to/ComfyUI/custom_nodes/ComfyUI-RandomAIPrompt
```

No `pip install` step — there are no third-party dependencies.

## Nodes

| Node | What it does |
|------|--------------|
| **🎲 Random AI Prompt** | The flagship. A DPL / natural-language template in (blank = fully random), a rich prompt out. Widgets: `template`, `seed` (with ComfyUI's *control_after_generate* — set *randomize* to re-roll, *fixed* to reproduce), `nsfw`, and a `preset` dropdown. |
| **🎲 Prompt List** | Draw one random entry from a named word list (`{list}`). |
| **🎲 Prompt Block** | Run one block generator (`{#block}`) — a scene / subject / style fragment. |
| **🎲 DPL Expand** | Expand any raw DPL template — the DPL processor, unadorned (for power users). |
| **🎲 Prompt Rewrite** | Rewrite a prompt through a text provider (auto-fix or keyword-translate). Bring your own API key. |

The `seed` on every node is ComfyUI's native seed control, so **re-roll** is just setting it to
*randomize*; a *fixed* seed reproduces the same prompt.

### Live dropdowns

The List / Block / Preset dropdowns are populated **live** from the engine's catalog via the plugin's
own same-origin routes (`/random_ai_prompt/catalog`, registered on ComfyUI's server) — so edits you make
in the app's Manage tab appear here without restarting ComfyUI.

## Testing

The engine + backend side is covered by the main repo's test suite (`tests/integration/promptApi.test.js`
exercises `/api/prompt` + `/api/prompt/catalog`). The ComfyUI nodes themselves must be validated inside a
running ComfyUI against a running app — that's a manual step on your machine.
