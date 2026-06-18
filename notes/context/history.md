# History

## 2022 — Origins (CommonJS)

The project started in 2022 as a CommonJS Node app (`require`/`module.exports`). It paired a yargs CLI
with an Express + Pug web UI to generate random/dynamic prompts for the Stable Diffusion WebUI and
manage the resulting images. The prompt system (dynamic prompts, lists, expansions, presets) and the
local image index were built out over many commits through 2022. A `Upgrade-2-0.md` note and a `dev`
branch existed, anticipating a 2.0.

The git history before 2026 lives in the repo log; representative late-2022 commits include preset
work for 2:1 images, "legacy detail wording," an upscale progress-screen fix, and assorted prompt
cleanup.

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
