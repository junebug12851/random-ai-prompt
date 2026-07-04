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
 *   - `tablet`  — 769px, the narrowest tablet (one past the 768px phone cap).
 *   - `phone`   — 345px, the narrowest width the layout is designed to support.
 * @type {Record<string, {width: number, height: number, label: string}>}
 */
export const VIEWPORTS = {
  desktop: { width: 1025, height: 768, label: "Desktop (1025×768)" },
  tablet: { width: 769, height: 1024, label: "Min tablet (769px)" },
  phone: { width: 345, height: 740, label: "Min phone (345px)" },
};

/** Order the viewports appear in the generated index. @type {string[]} */
export const VIEWPORT_ORDER = ["desktop", "tablet", "phone"];

/** Retina scale for the static PNG shots — crisper images for READMEs and Pages. */
export const STATIC_SCALE = 2;

/** Scale for GIF frames — kept at 1 so the animation files stay small. */
export const GIF_SCALE = 1;

/**
 * The public base URL the published screenshots live under (the project's GitHub Pages site).
 * The README references images as `${PAGES_BASE}/screenshots/<file>`.
 */
export const PAGES_BASE = "https://fairyfox.io/random-ai-prompt";

/** The port the local static preview server binds to during capture. */
export const PREVIEW_PORT = 4180;
