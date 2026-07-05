/**
 * @file
 * Shared configuration for the release-screenshot toolkit (`scripts/screenshots/`).
 *
 * The toolkit builds the LOCAL edition of the SPA, serves the static `dist/`, drives it with
 * Playwright, and emits ready-to-publish PNG screenshots (one per screen, per viewport) plus
 * authored GIF walkthroughs. The output is uploaded to GitHub Pages as part of the docs build
 * (`.github/workflows/pages.yml`) — it is **not** committed to the repo — so the README can
 * reference the images by their stable Pages URL. See `scripts/screenshots/README.md`.
 * @module scripts/screenshots/config
 */

/**
 * The viewports each screen is captured at. Widths are chosen to land squarely inside a
 * responsive tier so the captured chrome is unambiguous:
 *   - `desktop` — 1025px, one pixel past the 1024px tablet cap, so the full desktop UI renders.
 *   - `tablet`  — 770px, a narrow tablet width (above the 768px phone cap).
 *   - `phone`   — 345px, the narrowest width the layout is designed to support.
 * @type {Record<string, {width: number, height: number, label: string}>}
 */
export const VIEWPORTS = {
  desktop: { width: 1025, height: 768, label: "Desktop (1025×768)" },
  tablet: { width: 770, height: 1024, label: "Min tablet (770px)" },
  phone: { width: 345, height: 740, label: "Min phone (345px)" },
};

/** Order the viewports appear in the generated index. @type {string[]} */
export const VIEWPORT_ORDER = ["desktop", "tablet", "phone"];

/**
 * Device-scale factor for the static PNG shots. Kept at 1 so each shot's native pixel resolution is
 * exactly its viewport — a varying width (per device) by a fixed {@link STATIC_HEIGHT} tall — rather
 * than a 2× multiple. This is what the README relies on to embed every shot at a uniform height.
 */
export const STATIC_SCALE = 1;

/**
 * The fixed capture height, in pixels, for every static shot. Each viewport keeps its own native
 * width but is captured at this height, so all published shots are the same height (768) with widths
 * that vary by device. The shot is a viewport capture at this size — nothing is cropped afterward.
 */
export const STATIC_HEIGHT = 768;

/** Scale for GIF frames — kept at 1 so the animation files stay small. */
export const GIF_SCALE = 1;

/**
 * Colour scheme the captures render in. The app's default `themeMode` is `system`, which follows the
 * OS via `prefers-color-scheme`; forcing the browser context to dark renders the app in dark mode.
 */
export const COLOR_SCHEME = "dark";

/**
 * The public base URL the published screenshots live under (the project's GitHub Pages site).
 * The README references images as `${PAGES_BASE}/screenshots/<file>`.
 */
export const PAGES_BASE = "https://fairyfox.io/random-ai-prompt";

/** The port the local static preview server binds to during capture. */
export const PREVIEW_PORT = 4180;
