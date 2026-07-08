# The ComfyUI target — `targets/comfyui/`

A **ComfyUI custom-node package** that brings the prompt engine into ComfyUI as natural-language-first
`STRING` sources for a `CLIP Text Encode`. It's a build target (like `targets/cli/`), added 2026-07-07
(2.51.0). Added on `feature/comfyui-target`.

## The core reframe: prompt-side only

ComfyUI already owns the image half — model, sampler, upscaler, **variations** (a new seed / low
denoise), and **re-roll** (its native seed widget). So the engine's value inside ComfyUI is purely the
**prompt** half: the DPL processor, blocks, lists, and presets. That's the whole design boundary — we add
prompt nodes, and lean on ComfyUI for everything image. The user's original wishlist (upscale/variations
as engine nodes) was deliberately filtered out for this reason.

## Architecture: thin Python wrappers over the shared engine (point-at-running-app)

The nodes are Python (ComfyUI is Python) and **do not re-implement any engine logic**. Every node makes
an HTTP call to a **running Random AI Prompt app**'s local backend, which runs the one shared engine:

```
ComfyUI (Python nodes) ──HTTP──▶ app backend (/api/prompt, /api/prompt/catalog)
        │                              └─ the ONE shared engine (engine/nodeEngine.js + promptRun.js + presets.js)
        └─ web/randomAiPrompt.js ──▶ same-origin proxy routes (routes.py) ──▶ app backend
```

- **Point-at-running-app** (the chosen model): the nodes call `http://127.0.0.1:4173` (the desktop /
  `npm start` backend) by default; override via `RANDOM_AI_PROMPT_URL`, the ComfyUI **Settings** entry, or
  a single Settings-persisted config (no per-node URL widget — Settings is the one Comfy-native config
  point). The app need not be running when ComfyUI starts — dropdowns fill in and generation works once
  it's reachable.
- **No new engine code, no duplication.** The backend routes this target needs
  (`/api/prompt`, `/api/prompt/catalog`) were added to `apiHandler.js` reusing the extracted
  `engine/promptRun.js` (seed/reroll), `engine/nodeEngine.js` (the Node engine boot), and
  `engine/presets.js` (preset load + apply) — the same modules the CLI uses. Nothing was re-ported for
  ComfyUI. See [core-engine.md](core-engine.md) and [cli.md](cli.md).
- **Dependency-free.** The Python client uses only the standard library (`urllib`, `json`, `asyncio`), so
  the plugin needs no `pip install`.

## Layout

| Path | Role |
|------|------|
| `__init__.py` | Exposes `NODE_CLASS_MAPPINGS` / `NODE_DISPLAY_NAME_MAPPINGS` + `WEB_DIRECTORY`; imports `routes`. |
| `client.py` | The only thing that talks to the app backend — `generate` / `catalog` + the configured-URL store, base-URL resolution, friendly errors. Stdlib `urllib`. |
| `nodes.py` | The five node classes (fat generator + four helpers). |
| `routes.py` | Same-origin proxy routes on ComfyUI's server (`/random_ai_prompt/catalog`, `/status`) so the browser extension avoids cross-origin/CORS to the app. Best-effort (no-op outside ComfyUI). |
| `web/randomAiPrompt.js` | Frontend extension: a Settings URL field, LIVE list/block/preset dropdowns from the catalog, and a reachability warning. |
| `pyproject.toml` / `requirements.txt` / `README.md` | ComfyUI Registry metadata (no deps) + install/usage docs. |

## The nodes (fat generator + helpers)

- **🎲 Random AI Prompt** (`RandomAIPromptGenerator`) — the flagship. A DPL/natural-language `template`
  (blank = fully random) → a rich prompt `STRING`. Widgets: `template`, `seed` (ComfyUI's native
  `control_after_generate` → *randomize* re-rolls, *fixed* reproduces), `nsfw`, and a `preset` dropdown.
- **🎲 Prompt List** (`RandomAIPromptList`) — one random entry from a `{list}`.
- **🎲 Prompt Block** (`RandomAIPromptBlock`) — one block generator `{#block}`.
- **🎲 DPL Expand** (`RandomAIPromptDPL`) — expand any raw DPL (power users).

An AI-rewrite node was considered and **deliberately dropped**: a node whose job is to call a third-party
text API mid-graph (dragging BYOK keys into the graph) is off-paradigm for ComfyUI — the same reason
image gen / upscale stay native. Prompt polishing belongs in the app, not a node.

**Re-roll** is not a node — it's the native seed widget set to *randomize*. **Variations** and **upscale**
are native ComfyUI, not engine nodes. **Presets** are the built-in `engine/data/presets` (+ `user/presets`)
set, exposed via the catalog; applying most (image/upscale) presets doesn't change the prompt text — the
prompt-relevant ones (nsfw, non-anime, no-people) do.

## Live catalog dropdowns

`INPUT_TYPES` (Python) fetches the catalog best-effort so combos work even without the JS. The frontend
extension then refreshes them live from the same-origin `/random_ai_prompt/catalog` proxy — so edits in
the app's **Manage** tab appear in ComfyUI without a restart. (A future enhancement: a status sidebar over
the app's existing `/api/manage/watch` SSE; deferred because cross-origin SSE needs more proxying.)

## Verification

The **engine + backend** side is covered by the Node suite —
[`tests/integration/promptApi.test.js`](../../tests/integration/promptApi.test.js) drives the real
`createApiHandler` over localhost (generate, seed reproducibility, preset apply + unknown→400, catalog).
The **Python + ComfyUI-runtime JS** are syntax-checked (`ast.parse` / the target is out of the root JS
lint scope) but must be validated inside a **running ComfyUI against a running app** — a manual step on
the user's machine, since there's no ComfyUI runtime in CI.

## Data practices

The nodes talk only to the **local app backend** (localhost) — the same flow the app already discloses.
No third-party data flow at all (the AI-rewrite node that would have needed a provider was dropped), so
the legal pages are unchanged (re-checked 2026-07-07).
