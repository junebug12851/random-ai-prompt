/**
 * Pure, framework-free math for a **uniform-row virtualized grid** — the kind the photo gallery uses
 * to stay smooth with 100k+ items. Kept side-effect-free (no React, no DOM) so it's unit-testable on
 * its own; the component wires the scroll/resize listeners and feeds these numbers in. The Manage list
 * editor uses the equivalent inline math for its single-column entry list; this helper generalizes it
 * to N responsive columns for the gallery.
 * @module gui/lib/virtual/windowRange
 */

/**
 * How many equal columns fit a `width`, given a minimum cell width and inter-cell gap — mirrors CSS
 * `grid-template-columns: repeat(auto-fill, minmax(min, 1fr))`. Always at least 1.
 * @param {object} args
 * @param {number} args.width The available content width in px.
 * @param {number} args.minCell The minimum cell width in px.
 * @param {number} [args.gap] The gap between cells in px (default 0).
 * @returns {number} The column count (>= 1).
 */
export function columnsFor({ width, minCell, gap = 0 }) {
  if (!(width > 0) || !(minCell > 0)) return 1;
  // n cells + (n-1) gaps must fit: n*minCell + (n-1)*gap <= width  →  n <= (width+gap)/(minCell+gap)
  return Math.max(1, Math.floor((width + gap) / (minCell + gap)));
}

/**
 * The visible row window for a virtualized grid of `rowCount` uniform rows, each `rowHeight` px tall
 * (row height should already include the inter-row gap). `scrollTop` is the scroller's scroll offset;
 * `gridTop` is where the grid begins within that scroller (e.g. below a sticky header), so the grid's
 * own offset is `scrollTop - gridTop`. Returns the row range to render plus the spacer/total heights
 * that keep the scrollbar honest.
 * @param {object} args
 * @param {number} args.scrollTop The scroller's current scrollTop (px).
 * @param {number} [args.gridTop] The grid's offset within the scroller (px, default 0).
 * @param {number} args.viewportH The scroller's visible height (px).
 * @param {number} args.rowHeight The height of one row incl. gap (px, > 0).
 * @param {number} args.rowCount Total number of rows (>= 0).
 * @param {number} [args.overscan] Extra rows rendered above and below the viewport (default 2).
 * @returns {{startRow: number, endRow: number, topPad: number, totalHeight: number}}
 *   `startRow` inclusive, `endRow` exclusive; `topPad` = leading spacer px; `totalHeight` = full px.
 */
export function windowRange({ scrollTop, gridTop = 0, viewportH, rowHeight, rowCount, overscan = 2 }) {
  const rows = Math.max(0, Math.floor(rowCount) || 0);
  const rh = rowHeight > 0 ? rowHeight : 1;
  const totalHeight = rows * rh;
  if (rows === 0) return { startRow: 0, endRow: 0, topPad: 0, totalHeight: 0 };
  const vh = viewportH > 0 ? viewportH : 0;
  const offset = Math.min(Math.max(scrollTop - gridTop, 0), Math.max(0, totalHeight - vh));
  const startRow = Math.max(0, Math.floor(offset / rh) - overscan);
  const endRow = Math.min(rows, Math.ceil((offset + vh) / rh) + overscan);
  return { startRow, endRow, topPad: startRow * rh, totalHeight };
}
