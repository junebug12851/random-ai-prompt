# Random AI Prompt — ComfyUI nodes

Bring the [Random AI Prompt](https://github.com/1fairyfox/random-ai-prompt) engine into ComfyUI: the
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
repo), which serves the backend on `http://127.0.0.1:4173` by default. Configure the URL **once** — it
applies to both the dropdowns and generation — via, in precedence order:

1. **Settings → "Random AI Prompt — app URL"** in ComfyUI (persisted; the usual, Comfy-native way), then
2. the `RANDOM_AI_PROMPT_URL` environment variable, then
3. **auto-detection** — a running app on a standard port (**4173** desktop / `npm start`, or **5173**
   dev server) is found automatically, so it usually "just works" without any config, then
4. the default `http://127.0.0.1:4173`.

> Running the **dev server** (`npm run web`) instead of the desktop build? It serves on **`:5173`**, which
> is auto-detected — no config needed. (You can still pin it in the Settings field if you prefer.)

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
| **Random AI Prompt** | The flagship. A DPL / natural-language template in (blank = fully random), a rich prompt out. Widgets: `template`, `seed` (ComfyUI's *control_after_generate* — *randomize* to re-roll, *fixed* to reproduce), `nsfw`, and a `preset` dropdown. |
| **Prompt List** | Draw one random entry from a named word list (`{list}`). |
| **Prompt Block** | Run one block generator (`{#block}`) — a scene / subject / style fragment. |
| **DPL Expand** | Expand any raw DPL template — the DPL processor, unadorned (for writing DPL directly). |
| **Prompt Batch** | Generate N prompt variations as a **list**, to fan out into multiple images from one node. |
| **Combine Prompts** | Join several prompt pieces (List / Block / Generator outputs, or text) into one, skipping empties — build a prompt by hand. |
| **Show Prompt** | Display a prompt on the node (and pass it through) — see what the engine produced. |

The flagship sits at the top of the **Add Node → Random AI Prompt** menu; the helpers are grouped under
**Random AI Prompt/helpers**. Every input and output has a hover tooltip, and each node carries a
description. The `seed` on every generating node is ComfyUI's native seed control, so **re-roll** is just
setting it to *randomize*; a *fixed* seed reproduces the same prompt.

### Live dropdowns, sidebar, and an example workflow

The List / Block / Preset dropdowns are populated **live** from the engine's catalog via the plugin's own
same-origin routes (`/random_ai_prompt/catalog`, registered on ComfyUI's server) — so edits you make in
the app's Manage tab appear here without restarting ComfyUI. On newer ComfyUI frontends, a **sidebar tab**
shows the engine connection + catalog counts. And `example_workflows/random-ai-prompt.json` is a drag-in
starter (Random AI Prompt → Show Prompt) — wire the flagship's `prompt` output into your `CLIP Text
Encode` to feed image generation.

## Troubleshooting

- **"Won't connect."** Make sure the app is running (the desktop build, `npm start`, or the dev server
  `npm run web`). The plugin **auto-detects** it on `localhost:4173` / `localhost:5173` (both IPv4 and
  IPv6); for any other port, set **Settings → "Random AI Prompt — app URL"**. On startup the ComfyUI
  console prints `[Random AI Prompt] …` lines — `server routes registered` and the resolved app URL, or a
  WARNING with the reason if the routes couldn't register. Share those lines if it's still stuck.
- **Updated the plugin?** If you *copied* this folder into `custom_nodes`, re-copy it after each update
  (or symlink it), then **restart ComfyUI** so the Python changes load and **hard-refresh** the browser
  for the JS.

## Testing

The engine + backend side is covered by the main repo's test suite (`tests/integration/promptApi.test.js`
exercises `/api/prompt` + `/api/prompt/catalog`). The ComfyUI nodes themselves must be validated inside a
running ComfyUI against a running app — that's a manual step on your machine.
