/**
 * @file Playwright measurement helpers for the large-scale performance suite. Everything here is
 * chosen to be **robust, not flaky**: the primary signals are structural (rendered DOM-node count,
 * JS-heap ceiling) and coarse response-time / frame-time budgets set generously enough to survive a
 * loaded CI runner while still catching a true regression (an un-virtualized 100k list janks at
 * seconds per frame and blows the heap into the GBs — orders of magnitude past these budgets).
 */
import { galleryFeed, TINY_PNG } from "./fixtures.js";

/** Perf budgets. Generous on purpose (see file header) — they flag pathology, not micro-noise. */
export const BUDGETS = {
  maxGalleryCells: 400, // a windowed grid keeps only ~viewport+overscan cells, whatever the total
  maxManageRows: 300, // same idea for the Manage list editor's windowed entry rows
  scrollMedianMs: 40, // ~25fps median inter-frame time while scrolling
  scrollP95Ms: 150, // occasional slow frames tolerated; sustained jank is not
  tabSwitchMs: 1500, // click a tab → its content is visible
  heapCeilingMB: 900, // whole-app heap under the max combined load (an unbounded DOM would dwarf this)
};

/**
 * Route the gallery feed + image bytes so a spec can push 100k items through the real app without a
 * backend or real files. `GET /api/feed` returns the synthetic feed; every `/api/output/*` returns a
 * 1x1 PNG. Call before navigating.
 * @param {import("@playwright/test").Page} page The page.
 * @param {number} n How many feed items.
 * @returns {Promise<void>}
 */
export async function routeGallery(page, n) {
  const body = JSON.stringify(galleryFeed(n));
  await page.route("**/api/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body }),
  );
  await page.route("**/api/output/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );
}

/**
 * Count elements matching `selector` (how many are actually in the DOM — the virtualization proof).
 * @param {import("@playwright/test").Page} page The page.
 * @param {string} selector The CSS selector.
 * @returns {Promise<number>}
 */
export function domCount(page, selector) {
  return page.locator(selector).count();
}

/**
 * The page's used JS heap in MB (Chromium `performance.memory`; precise with
 * `--enable-precise-memory-info`, which the perf config sets). Null where unavailable.
 * @param {import("@playwright/test").Page} page The page.
 * @returns {Promise<number|null>}
 */
export async function heapMB(page) {
  const bytes = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : null,
  );
  return bytes == null ? null : Math.round(bytes / (1024 * 1024));
}

/**
 * Scroll a container across `steps` animation frames, sampling the inter-frame interval each frame —
 * a direct measure of scroll smoothness under load. Runs entirely in-page so it observes the real
 * compositor cadence.
 * @param {import("@playwright/test").Page} page The page.
 * @param {object} opts
 * @param {string} opts.scroller CSS selector of the scrollable element.
 * @param {number} [opts.distance] Total px to scroll (default: the element's full scroll range).
 * @param {number} [opts.steps] Frames to spread the scroll across (default 120).
 * @returns {Promise<{count: number, median: number, p95: number, max: number, long: number}>}
 *   Frame-interval stats in ms; `long` = count of frames slower than 50ms.
 */
export function scrollAndSampleFrames(page, { scroller, distance, steps = 120 }) {
  return page.evaluate(
    ({ scroller, distance, steps }) =>
      new Promise((resolve) => {
        const el = globalThis.document.querySelector(scroller);
        if (!el) return resolve({ count: 0, median: 0, p95: 0, max: 0, long: 0 });
        const total = distance ?? Math.max(0, el.scrollHeight - el.clientHeight);
        const perStep = total / steps;
        const deltas = [];
        let last = performance.now();
        let i = 0;
        const step = (now) => {
          deltas.push(now - last);
          last = now;
          if (i < steps) {
            el.scrollTop += perStep;
            i++;
            globalThis.requestAnimationFrame(step);
          } else {
            const sorted = deltas.slice(1).sort((a, b) => a - b); // drop the first (warm-up) delta
            const at = (p) =>
              sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
            resolve({
              count: sorted.length,
              median: Math.round(at(0.5)),
              p95: Math.round(at(0.95)),
              max: Math.round(sorted[sorted.length - 1] || 0),
              long: sorted.filter((d) => d > 50).length,
            });
          }
        };
        // Prime with two frames so the first measured interval isn't the scheduling warm-up.
        globalThis.requestAnimationFrame((t) => {
          last = t;
          globalThis.requestAnimationFrame(step);
        });
      }),
    { scroller, distance, steps },
  );
}

/**
 * Time an action until a condition holds — e.g. click a tab and wait for its content. Returns
 * elapsed ms. Uses the wall clock around Playwright ops (coarse but that's the point).
 * @param {Function} action An async fn performing the interaction.
 * @param {Function} settle An async fn that resolves once the result is visible.
 * @returns {Promise<number>} Elapsed milliseconds.
 */
export async function timeUntil(action, settle) {
  const t0 = Date.now();
  await action();
  await settle();
  return Date.now() - t0;
}
