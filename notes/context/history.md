# History

## 2022–2023 — Origins (CommonJS)

The project started in 2022 as a CommonJS Node app (`require`/`module.exports`). It paired a yargs CLI
with an Express + Pug web UI to generate random/blocks for the Stable Diffusion WebUI and
manage the resulting images.

This was **not** a small project — the overwhelming majority of the codebase, the prompt DSL, and the
web app were built in a concentrated burst. By commit volume: **~178 commits in December 2022, ~160 in
January 2023**, then a long tail (~11 in March, ~2 in April 2023) before the project went quiet until
the 2026 revival. The original layout was **flat** (everything at the repo root: `blocks/`,
`prompt-modules/`, `helpers/`, `lists/`, `expansions/`, `presets/`, `web/`); the `src/`+`data/` split
came only with the 2026 reorg. A `Upgrade-2-0.md` note, an `update.bat`, and a `dev` branch already
existed, anticipating a 2.0.

The arc of that original effort, read from the git log:

- **Dec 2022 — the engine and the content.** The prompt mini-language took shape (expansions, the
  `{list}` system with once-only depletion, block plugins), alongside a large content push:
  city/time/weather/building-style/render-color lists, the discovery and crediting of CC-licensed tag
  lists (u/Carlyone and others — see `list-credits.md`), and steadily improved `person`, `landscape`,
  `house`, and `city` generators. The danbooru/anime keyword path and emphasis/editing/alternating
  randomization were part of this period.
- **Jan 2023 — the web app matured.** Blocks gained the **full vs partial** classification the
  suggestion engine and pickers still use; the WebUI grew a full **Generate** tab (in-browser
  generation), a richer **image-details** view (upscales / re-rolls / variations / animation frames,
  newest-first), **animation** support including frame-extension and APNG, ImageMagick conversion,
  plain-text/markdown parameter copying, and the self-healing image index. The block expander
  was rebuilt from a 2-pass scheme into the clean **up-to-10-levels** recursive form. There's even a
  Jan-21 commit sketching a "custom scripting language for blocks" — an ambition the project
  never finished but that explains the plugin-as-function design.
- **Mar–Apr 2023 — polish and pause.** LoRA support threaded through expansions, presets for many image
  sizes (wallpapers, ultra-wide, 2:1), "legacy detail wording," and an upscale progress-screen fix —
  then the repo went dormant.

The full micro-design of the language that came out of this period is documented in
[`../reference/prompt-dsl.md`](../reference/prompt-dsl.md).

### Reading the original directly

A read-only snapshot of the last pre-revival commit is pinned locally (gitignored, not shipped) at
`assets/references/og-pre-revival-2023-04-07-241a148/` — a clone of the repo checked out at `241a148`
(*"Added presets to create 2:1 images"*, 2023-04-07), the final 2023 commit before the 2026 ESM
modernization began. Treat it like any other reference: **read-only**, never a build input. It preserves
the original **flat CommonJS layout** and its own `.git`, so the original source and its history can be
inspected without untangling them from the modernized tree.

## 2026-06-18 — The 2.0.0 modernization

The project was revived and modernized in one focused effort (see
[`../sessions/2026-06/2026-06-18.md`](../sessions/2026-06/2026-06-18.md) and the
[June 2026 changelog](../version/2026-06.md)):

- **CommonJS → ES modules** across ~130 files.
- **Runtime → Node 24 LTS** (`.nvmrc`, `engines`).
- **Dependencies → current majors**, and **`node-fetch` dropped** for the built-in `fetch`.
- **Tooling:** ESLint 9 flat config + Prettier 3, plus editorconfig/nvmrc and `npm` scripts.
- **A `CLAUDE.md` + `notes/` system** and a `VERSION` single-source-of-truth were added so future work
  (human or AI) starts oriented.

This was a deliberate semver-**major** jump (2.0.0): it breaks anyone on an old Node or expecting the
CommonJS module shape. The conversion was verified by lint + `node --check` + an import smoke test;
live image generation (which needs a running SD WebUI) was left for a follow-up.
