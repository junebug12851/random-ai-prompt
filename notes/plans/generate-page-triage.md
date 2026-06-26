# Plan — Carry-over triage of the old `/generate` page

**Status: decisions made 2026-06-25; no code changed yet.** This is the disposition of every control on
the **legacy** classic-server prompt page (`src/web/views/generate.pug`) — what carries over to the new
SPA/core engine, what gets dropped, and in what order. The classic server is frozen and slated for
deletion (see the `classic-server-read-only` directive); this doc is the record of what must be salvaged
from it **before** it goes.

## Why the old page felt like a "mash"

It flattens **three different concerns** into one settings blob, and presets could carry all three at once:

1. **Prompt-text generation / randomization** (the engine's job)
2. **What gets sent to the image AI** (a provider's job)
3. **Per-image actions** ("upscale this file", "make a variation") — not settings at all

Splitting by concern is most of the cleanup. The old hardcoded-defaults → global-overrides →
local-overrides (presets) layering is *why* prompt knobs and image-AI knobs sit side by side.

## Disposition

### A — Image-AI settings → **provider abstraction** (deferred, big, later)
Re-homed into the future provider-abstraction project; left as-is until that conversation. Split on a
"universal to all providers vs. specific to one" axis.

| Control | data-path | Axis |
|---|---|---|
| Target AI | `settings.mode` | becomes the provider **selector** |
| Stable Diffusion URL | `imageSettings.url` | per-provider connection |
| Generate / Upscale Images | `settings.generateImages` / `upscaleImages` | workflow toggles |
| Negative Prompt | `imageSettings.negativePrompt` | universal-ish (SD/NAI; MJ none) |
| Images Per Prompt | `imageSettings.batchCount` | universal-ish |
| Seed | `imageSettings.seed` | universal |
| Width / Height | `imageSettings.width` / `height` | universal value, provider-constrained step |
| Sampler | `imageSettings.sampler` | SD-specific |
| Steps | `imageSettings.steps` | SD/NAI |
| CFG | `imageSettings.cfg` | SD/NAI |
| Restore Faces | `imageSettings.restoreFaces` | SD-specific |
| High-res Detail | `imageSettings.denoising` | SD-specific |
| Variation Percent | `imageSettings.subseedStrength` | SD-specific; tied to variation action |
| All 12 upscale fields | `upscaleSettings.*` | SD-WebUI extras/upscaler-specific; likely its own "upscale provider" |

### B — Emphasis / editing / alternating → **rework, provider-dependent** (rides on A)
Keep emphasis/de-emphasis as an **input** concept; the **output** form is the problem. The old nested-paren
`(((x)))` / `[[[x]]]` style + booru-era "masterpiece, best quality" framing is dated. Verified 2026-06-25:
`(word:1.2)` weighting still exists in ComfyUI but **Flux has minimal sensitivity** to weights, and modern
models favor natural-language prompting. So:

- **Keep** emphasis/de-emphasis as user **input** intent.
- **Output becomes provider-dependent** (each provider emits its own modern form, or none for Flux-like).
- **Cut** the global stochastic auto-roll: `emphasisChance`, `emphasisLevelChance`, `emphasisMaxLevels`,
  `deEmphasisChance`, `keywordEmphasis`, `keywordEditing` + min/max, `keywordAlternating` + max levels,
  and `chaos` (which only scaled that envelope).

### C — Replaced by DPL → **remove**
`chaos`; `keywordCount` / `keywordMaxCount` (→ DPL repeat); `autoAddFx` (→ v3 wrapper end-block);
`autoAddArtists` / `includeArtist` / `minArtist` / `maxArtist` (→ DPL + wrapper); Anime / Non-Anime Words
(→ explicit list selection in DPL).

### D — Dead features → **remove**
All animation: `to-animation-file`, `extend-animation-file`, `animationStartFrame`, `animationFrameCount`,
`animationDelay`. (Animations never worked well.)

### E — Per-image **actions** → **future full image viewer/editor** (not built yet)
Image Variation, Re-Roll Image, Re-Roll Which Part, Upscale Image (all `data-skip="true"` — never persisted
to presets anyway). These are "do X to this file" commands; they belong in the image viewer/editor, not the
generator.

### F — Paths + pipeline → **port to the SPA UI/UX as app config**
The six folder paths (image / list / expansion / preset / dynamic-prompt / prompt-module files) and
`settings.promptModules` (pipeline order). In v3 the pipeline *is* the engine; surface what's still
user-relevant as app config, drop the rest.

### Keepers → **port into the main SPA UI/UX**
- `promptCount` (Prompts) — run-level count. **Keep.**
- `keywordsFilename` / `artistFilename` (Default Keyword/Artist List selectors) — **keep, still important.**

### Park (investigate, don't delete)
- `listEntriesUsedOnce` (Unique Entries) + `reloadListsOnPromptChange` (Each Prompt) — sounds useful;
  behavior not fully remembered. Investigate before deciding.

### Dropped, handled elsewhere
- `promptSalt` / `promptSaltStart` (Auto-add Salt + Starting Number) — bad idea in hindsight; the `{salt}`
  token already covers salting. Remove the settings; handle differently if ever needed.

## The four sweeps (dependency-ordered — where to begin)

1. **Prune (start here).** Drop C, D, and the salt settings. Zero dependencies, removes ~20 controls,
   makes everything else legible. Lowest risk, highest clarity.
2. **Port the keepers to the SPA UI.** `promptCount`, keyword/artist list selectors, and the F paths as
   app config. Makes the new generator actually usable.
3. **Park with a paper trail.** Record "unique entries — investigate"; tag the E per-image actions for the
   future image viewer/editor. No building.
4. **Provider abstraction (A) + emphasis rework (B).** The big one, later — B's output depends on knowing
   the provider, so it folds into A. Don't start until ready for that conversation.

## See also
- [`v3-layers.md`](v3-layers.md) — weighted-layer engine; the wrapper that supplies start/end framing
  (replaces `autoAddFx`/`autoAddArtists`).
- [`../reference/prompt-dsl.md`](../reference/prompt-dsl.md) — the emphasis/editing/alternating math being
  reworked, and the `{salt}` token.
- [`next-steps.md`](next-steps.md) — Sweep 1 tracked there as the next concrete item.
