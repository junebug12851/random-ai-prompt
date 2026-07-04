# Release screenshots & walkthroughs

Automated, always-current screenshots and animated GIFs of the app, regenerated **on every release**
and published to the GitHub Pages site (they are **not** committed to the repo). The README references
them by their stable Pages URL.

## How it works

`capture.mjs` builds the **local** edition of the SPA (`npm run web:build`), serves the static
`gui/dist/` on a throwaway server, drives it with Playwright, and writes:

- **PNG shots** — one per screen, per viewport: `‹screen›-‹viewport›.png`
- **GIF walkthroughs** — one per registered scenario: `‹name›.gif`
- **`index.json`** — a manifest (version, files, viewports)
- **`index.html`** — a browsable gallery of everything

The local-only screens (Gallery / Single / Manage) have no filesystem backend when served statically,
so `seed.mjs` intercepts the `/api/*` calls with representative sample data (gradient placeholder
thumbnails, a sample content tree, etc.). No real user content is shipped.

## Viewports (`config.mjs`)

| Key | Width | Why |
|-----|-------|-----|
| `desktop` | **1025px** | one past the 1024 tablet cap → full desktop UI |
| `tablet` | **769px** | narrowest tablet (one past the 768 phone cap) |
| `phone` | **345px** | narrowest supported width |

Static PNGs are captured at 2× (retina) for crispness; GIF frames at 1× to stay small.

## Run it locally

```
npm run screenshots
```

Output lands in `screenshots-preview/` (git-ignored). Open `screenshots-preview/index.html` to review.
Add `-- --skip-gifs` while iterating on static shots; the script rebuilds the SPA each run (drop the
`--build` in the npm script if you want to reuse an existing `gui/dist`).

## Where the published images live

The Pages workflow emits them under the docs site, so each file is reachable at:

```
https://fairyfox.io/random-ai-prompt/screenshots/‹file›
```

e.g. `…/screenshots/generate-desktop.png`, `…/screenshots/gallery-phone.png`,
`…/screenshots/prompt-blocks.gif`. The browsable index is `…/screenshots/` (its `index.html`).
Reference these absolute URLs from `README.md` (they render on both GitHub and the Pages site).

## Add a screen (static shot)

Append an entry to `SHOTS` in `shots.mjs`: give it a `name`, a `title`, and an async `shoot(page, ctx)`
that navigates, waits for the screen to settle, and returns a screenshot buffer (`shootFull` for the
whole page, `shootEl` for one element). `ctx.width` lets you branch on viewport.

## Add a GIF walkthrough

1. Write a scenario module in `scenarios/` (see `prompt-blocks.mjs`). It exports a default object with
   `name`, `title`, `description`, `viewport`, `durationMs`, `clipSelector` (the element captured every
   frame), and an async `run(page, rec)` that drives the app and calls `await rec.frame()` at each step
   (`rec.hold(n)` repeats the last frame to pause). The encoder pads the frames out to `durationMs`.
2. Register it in `gifs.mjs`.

**Smooth motion:** capture a frame per small step (one character per keystroke, a few pixels per cursor
move) so the animation reads smoothly.

**Mouse-cursor GIFs:** Playwright screenshots don't include the OS pointer, so use `cursor.mjs` —
call `installCursor(page)` after `page.goto`, then `moveCursorTo(page, rec, selector)` /
`clickAt(page, rec, selector)` to glide a synthetic pointer (eased motion, a frame per step) and click.

## Published on release

`.github/workflows/pages.yml` runs the capture into `docs/jsdoc/screenshots` right before uploading the
Pages artifact, so the set refreshes with every push to `main` (i.e. every release).
