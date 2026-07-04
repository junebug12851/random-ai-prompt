/**
 * The photo gallery grid — a browseable feed of every image saved to `output/`, each paired with
 * its `.json` metadata sidecar. A **virtualized** responsive grid of lazy-loaded thumbnails with a
 * keyword search box; clicking a thumbnail opens it in the single-image view (a sibling top-level
 * view).
 *
 * Virtualized so it scales to very large galleries (100k+ images) with no performance loss: only the
 * cells inside (and just around) the viewport are in the DOM, positioned with a leading spacer and a
 * full-height container so the scrollbar stays honest. The math lives in the pure, unit-tested
 * `lib/virtual/windowRange` helper. Cells are uniform squares (`object-fit: cover`) — the fixed cell
 * size is what makes row-windowing exact at scale.
 *
 * This is a controlled component: the feed (`items`), loading flag, and search `query` live in
 * `App` so the gallery keeps its place when you switch tabs (the view stays mounted, just hidden).
 * Local-only: the feed needs the dev server's filesystem access, so a static/online build passes an
 * empty list and the grid shows an explanatory note.
 * @module gui/components/Gallery
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIntl, defineMessages, FormattedMessage } from "react-intl";
import { searchHaystack, promptText } from "../lib/gallery.js";
import { isOutputFile, openImageFile, revealImageFile } from "../lib/output.js";
import { columnsFor, windowRange } from "../lib/virtual/windowRange.js";

// Uniform cell geometry (px). CELL matches the historical grid-auto-rows/min-column size; GAP the
// grid gap. ROW_H (cell + gap) is the row pitch the windowing math steps by. OVERSCAN rows render
// just outside the viewport so a fast fling never shows a blank band.
const CELL = 180;
const GAP = 8;
const ROW_H = CELL + GAP;
const OVERSCAN = 3;

const msgs = defineMessages({
  title: { id: "gallery.title", defaultMessage: "Photo gallery" },
  loading: { id: "gallery.loading", defaultMessage: "loading…" },
  countImages: {
    id: "gallery.countImages",
    defaultMessage: "{count, plural, one {# image} other {# images}}",
  },
  countMatches: {
    id: "gallery.countMatches",
    defaultMessage: "{count, plural, one {# match} other {# matches}}",
  },
  searchPlaceholder: {
    id: "gallery.searchPlaceholder",
    defaultMessage: "Search prompts, DPL, provider…",
  },
  rescanTitle: { id: "gallery.rescanTitle", defaultMessage: "Rescan the output folder" },
  refresh: { id: "gallery.refresh", defaultMessage: "Refresh" },
  emptyNone: { id: "gallery.emptyNone", defaultMessage: "No images yet." },
  noMatch: {
    id: "gallery.noMatch",
    defaultMessage: "No images match “{query}”.",
  },
  openAria: {
    id: "gallery.openAria",
    defaultMessage: "Open: {label}",
    description: "aria-label on a gallery thumbnail (label = the image's prompt)",
  },
  openDefault: { id: "gallery.openDefault", defaultMessage: "Open in default app" },
  reveal: { id: "gallery.reveal", defaultMessage: "Reveal in file explorer" },
  delete: { id: "gallery.delete", defaultMessage: "Delete image" },
});

/**
 * A thumbnail that fades in once loaded. Hovering reveals the same actions as the generate
 * thumbnails: open in the OS default app, reveal in the file explorer, and delete.
 */
function Thumb({ item, onOpen, onDelete }) {
  const intl = useIntl();
  const [loaded, setLoaded] = useState(false);
  const label = promptText(item) || item.file;
  const onDisk = isOutputFile(item.path);
  return (
    <div className="g-cell">
      <button
        className="g-open"
        onClick={() => onOpen(item)}
        title={label}
        aria-label={intl.formatMessage(msgs.openAria, { label })}
      >
        <img
          src={item.path}
          alt={label}
          loading="lazy"
          decoding="async"
          className={`g-img${loaded ? " loaded" : ""}`}
          onLoad={() => setLoaded(true)}
        />
        {promptText(item) && <span className="g-cell-cap">{promptText(item).slice(0, 120)}</span>}
      </button>
      <div className="img-actions">
        {onDisk && (
          <>
            <button title={intl.formatMessage(msgs.openDefault)} onClick={() => openImageFile(item.path)}>
              ↗
            </button>
            <button title={intl.formatMessage(msgs.reveal)} onClick={() => revealImageFile(item.path)}>
              ⌖
            </button>
          </>
        )}
        {onDelete && (
          <button title={intl.formatMessage(msgs.delete)} onClick={() => onDelete(item)}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The photo gallery grid (virtualized).
 * @param {object} props
 * @param {object[]} props.items The feed items (newest first).
 * @param {boolean} props.loading Whether the feed is still loading.
 * @param {string} props.query The current search query (lives in App).
 * @param {Function} props.onQueryChange `(value)`.
 * @param {Function} props.onOpen `(item)` — open an image in the single view.
 * @param {Function} props.onRefresh Re-scan the output folder.
 * @param {Function} [props.onDelete] `(item)` — delete an image (+ sidecar) from disk.
 * @returns {JSX.Element}
 */
export default function Gallery({
  items,
  loading,
  query,
  onQueryChange,
  onOpen,
  onRefresh,
  onDelete,
}) {
  const intl = useIntl();
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => searchHaystack(it).includes(q)) : items),
    [items, q],
  );

  const scrollerRef = useRef(null);
  const gridRef = useRef(null);
  // Live scroll/size metrics that drive the window. `gridTop` is where the grid begins within the
  // scroller (below the header), so the grid's own offset is scrollTop - gridTop.
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportH: 0, width: 0, gridTop: 0 });

  // Re-measure the scroller + grid geometry (viewport height, content width, grid offset, scrollTop).
  // Cheap: a couple of rect reads, coalesced via rAF on scroll.
  const measure = () => {
    const sc = scrollerRef.current;
    const grid = gridRef.current;
    if (!sc) return;
    const scRect = sc.getBoundingClientRect();
    const gridTop = grid ? grid.getBoundingClientRect().top - scRect.top + sc.scrollTop : 0;
    setMetrics((m) => {
      const next = {
        scrollTop: sc.scrollTop,
        viewportH: sc.clientHeight,
        width: grid ? grid.clientWidth : sc.clientWidth,
        gridTop,
      };
      // Skip the state churn if nothing meaningful moved (avoids a scroll→render feedback loop).
      if (
        next.scrollTop === m.scrollTop &&
        next.viewportH === m.viewportH &&
        next.width === m.width &&
        next.gridTop === m.gridTop
      )
        return m;
      return next;
    });
  };

  // Measure on mount + whenever the scroller resizes (incl. becoming visible on a tab switch, and
  // the header wrapping on narrow screens, which shifts the grid's top).
  useLayoutEffect(() => {
    measure();
    const sc = scrollerRef.current;
    if (!sc || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(sc);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  // rAF-throttle scroll so a fast fling doesn't dispatch a setState per scroll event.
  const rafRef = useRef(0);
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      measure();
    });
  };
  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const cols = columnsFor({ width: metrics.width, minCell: CELL, gap: GAP });
  const rowCount = Math.ceil(filtered.length / cols);
  const { startRow, endRow, topPad, totalHeight } = windowRange({
    scrollTop: metrics.scrollTop,
    gridTop: metrics.gridTop,
    viewportH: metrics.viewportH || 600, // a sane default before the first measure
    rowHeight: ROW_H,
    rowCount,
    overscan: OVERSCAN,
  });
  const windowStart = startRow * cols;
  const windowEnd = Math.min(filtered.length, endRow * cols);
  const windowItems = filtered.slice(windowStart, windowEnd);

  return (
    <div className="gallery-view" ref={scrollerRef} onScroll={onScroll}>
      <div className="g-inner">
        <div className="g-head">
          <div className="g-head-left">
            <h2 className="g-title">{intl.formatMessage(msgs.title)}</h2>
            <span className="g-count">
              {loading
                ? intl.formatMessage(msgs.loading)
                : intl.formatMessage(msgs.countImages, { count: items.length })}
              {!loading &&
                q &&
                ` · ${intl.formatMessage(msgs.countMatches, { count: filtered.length })}`}
            </span>
          </div>
          <div className="g-head-right">
            <input
              className="g-search"
              placeholder={intl.formatMessage(msgs.searchPlaceholder)}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <button
              className="link-btn"
              onClick={onRefresh}
              title={intl.formatMessage(msgs.rescanTitle)}
            >
              {intl.formatMessage(msgs.refresh)}
            </button>
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div className="g-empty">
            <p>{intl.formatMessage(msgs.emptyNone)}</p>
            <p className="g-empty-sub">
              <FormattedMessage
                id="gallery.emptySub"
                defaultMessage="Generate some images and they'll appear here, read straight from your <code>output/</code> folder. (The gallery needs the local dev server — a static build has no folder to read.)"
                values={{ code: (chunks) => <code>{chunks}</code> }}
              />
            </p>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="g-empty">
            <p>{intl.formatMessage(msgs.noMatch, { query })}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="g-grid-window" ref={gridRef} style={{ height: totalHeight }}>
            <div
              className="g-grid"
              style={{
                transform: `translateY(${topPad}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridAutoRows: `${CELL}px`,
                gap: `${GAP}px`,
              }}
            >
              {windowItems.map((item) => (
                <Thumb key={item.path} item={item} onOpen={onOpen} onDelete={onDelete} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
