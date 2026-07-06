/**
 * @file Unit tests for the pure virtualized-grid math (gui/src/lib/virtual/windowRange.js). These
 * guard the windowing invariants the gallery relies on to stay bounded at 100k+ items: the rendered
 * row window is always small regardless of total count, spacers keep the scrollbar honest, and the
 * column math matches CSS auto-fill.
 */
import { describe, it, expect } from "vitest";
import { columnsFor, windowRange } from "../../frontend/lib/virtual/windowRange.js";

describe("columnsFor", () => {
  it("matches CSS auto-fill minmax packing", () => {
    // 1440 content px, 180px min cells, 8px gaps → floor((1440+8)/(180+8)) = 7
    expect(columnsFor({ width: 1440, minCell: 180, gap: 8 })).toBe(7);
    expect(columnsFor({ width: 180, minCell: 180, gap: 8 })).toBe(1);
    expect(columnsFor({ width: 368, minCell: 180, gap: 8 })).toBe(2); // 2*180 + 8 = 368 fits exactly
    expect(columnsFor({ width: 367, minCell: 180, gap: 8 })).toBe(1); // one px short of two columns
  });

  it("never returns less than 1, even for degenerate inputs", () => {
    expect(columnsFor({ width: 0, minCell: 180, gap: 8 })).toBe(1);
    expect(columnsFor({ width: 100, minCell: 180, gap: 8 })).toBe(1);
    expect(columnsFor({ width: -5, minCell: 0, gap: 8 })).toBe(1);
  });
});

describe("windowRange", () => {
  const base = { rowHeight: 100, viewportH: 500, overscan: 2 };

  it("renders only a small window even for a huge row count", () => {
    const { startRow, endRow, totalHeight } = windowRange({
      ...base,
      scrollTop: 0,
      rowCount: 100000,
    });
    expect(startRow).toBe(0);
    // 500/100 = 5 visible rows + 2 overscan below
    expect(endRow).toBe(7);
    expect(endRow - startRow).toBeLessThan(12); // bounded regardless of the 100k total
    expect(totalHeight).toBe(100000 * 100);
  });

  it("scrolls the window and adds overscan on both sides", () => {
    const { startRow, endRow, topPad } = windowRange({
      ...base,
      scrollTop: 5000, // row 50
      rowCount: 100000,
    });
    expect(startRow).toBe(48); // 50 - 2 overscan
    expect(endRow).toBe(57); // ceil((5000+500)/100) + 2 = 55 + 2
    expect(topPad).toBe(48 * 100);
  });

  it("accounts for a grid offset within the scroller (a header above the grid)", () => {
    const withHeader = windowRange({ ...base, scrollTop: 300, gridTop: 300, rowCount: 1000 });
    const atTop = windowRange({ ...base, scrollTop: 0, gridTop: 0, rowCount: 1000 });
    expect(withHeader.startRow).toBe(atTop.startRow);
    expect(withHeader.topPad).toBe(atTop.topPad);
  });

  it("clamps the window at the end (never past the last row)", () => {
    const { startRow, endRow } = windowRange({
      ...base,
      scrollTop: 10_000_000, // way past the end
      rowCount: 100,
    });
    expect(endRow).toBe(100);
    expect(startRow).toBeLessThanOrEqual(100);
    expect(startRow).toBeGreaterThanOrEqual(0);
  });

  it("handles an empty list without producing negatives", () => {
    expect(windowRange({ ...base, scrollTop: 0, rowCount: 0 })).toEqual({
      startRow: 0,
      endRow: 0,
      topPad: 0,
      totalHeight: 0,
    });
  });

  it("never returns a negative startRow near the top", () => {
    const { startRow, topPad } = windowRange({ ...base, scrollTop: 50, rowCount: 1000 });
    expect(startRow).toBe(0);
    expect(topPad).toBe(0);
  });
});
