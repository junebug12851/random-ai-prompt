# Release screenshots & walkthroughs

Automated, always-current screenshots and animated GIFs of the app, regenerated **on every release**
and published to the GitHub Pages site (they are **not** committed to the repo). The README references
them by their stable Pages URL.

## How it works

`capture.mjs` builds the **local** edition of the SPA (`npm run web:build`), serves the static
`gui/dist/` on a throwaway server, drives it with Playwright, and writes:

- **PNG shots** — one per screen, per viewport: `‹screen›-‹viewport›.png`, all a uniform height
  (see below)
- **GIF walkthroughs** — one per registered scenario: `‹name›.gif`
- **`index.json`** — a manifest (version, files, viewports)
- **`index.html`** — a browsable gallery of everything

The local-only screens (Gallery / Single / Manage) have no filesystem backend when served statically,
so `seed.mjs` intercepts the `/api/*` calls. Gallery + Single are backed by the **committed sample
images** in `assets/gallery/` — real generated images optimized to JPEG (~1024px) plus a
`manifest.json` carrying their real prompt/metadata, sanitized of any personal info / absolute file
paths. `manifest.single` names the image the Single view opens. Manage uses a small synthetic tree.

To refresh the sample set: put new images in the app's `output/` folder, regenerate the optimized JPEGs
into `assets/gallery/`, and rebuild `manifest.json` from the sidecars (keeping only safe fields).

## Viewports (`config.mjs`)

| Key | Width | Why |
|-----|-------|-----|
| `desktop` | **1025px** | one past the 1024 tablet cap → full desktop UI |
| `tablet` | **770px** | a narrow tablet width (above the 768 phone cap) |
| `phone` | **345px** | narrowest supported width |

Every static shot is a **viewport capture at a fixed height** — the viewport keeps the width above
but is forced to `STATIC_HEIGHT` (768px, in `config.mjs`) tall, and the shot is the viewport (not
`fullPage`). So each PNG's native resolution is that device's width by a uniform 768px height —
varying widths, one height, nothing cropped afterward. This lets the README embed the shots by their
Pages URL and have every image render at the same height. `STATIC_SCALE` is `1`, so the native pixel
height is exactly 768; GIF frames use their own `GIF_SCALE`. To change the height, edit
`STATIC_HEIGHT`. (Because the capture is the viewport, the tall phone shots — `block-menu` and
`manage-editor` — show what fits in 768px rather than their whole list.)

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
