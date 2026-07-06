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
 *
 * Two extras layer onto the grid:
 *   - a `composer` slot rendered above the header (the narrow prompt box atop the Gallery), and
 *   - `pending` **placeholder** cells prepended to the grid — busy skeletons for images that are
 *     generating right now (from the gallery's own prompt box), which drop out as the finished
 *     images land in the feed.
 * And a **multi-select** mode: a per-cell checkbox with select-all / clear and a mass delete.
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
  searchAria: { id: "gallery.searchAria", defaultMessage: "Search the gallery" },
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
  selectAria: {
    id: "gallery.selectAria",
    defaultMessage: "Select: {label}",
    description: "aria-label on a gallery thumbnail while in multi-select mode",
  },
  openDefault: { id: "gallery.openDefault", defaultMessage: "Open in default app" },
  reveal: { id: "gallery.reveal", defaultMessage: "Reveal in file explorer" },
  delete: { id: "gallery.delete", defaultMessage: "Delete image" },
  // Multi-select
  select: { id: "gallery.select", defaultMessage: "Select" },
  selectTitle: { id: "gallery.selectTitle", defaultMessage: "Select multiple images to delete" },
  done: { id: "gallery.done", defaultMessage: "Done" },
  doneSelecting: { id: "gallery.doneSelecting", defaultMessage: "Exit selection" },
  selectAll: { id: "gallery.selectAll", defaultMessage: "Select all" },
  clearSelection: { id: "gallery.clearSelection", defaultMessage: "Clear" },
  selectedCount: {
    id: "gallery.selectedCount",
    defaultMessage: "{count, plural, =0 {None selected} one {# selected} other {# selected}}",
  },
  deleteSelected: {
    id: "gallery.deleteSelected",
    defaultMessage: "{count, plural, one {Delete # image} other {Delete # images}}",
  },
  selectionBarAria: { id: "gallery.selectionBarAria", defaultMessage: "Selection actions" },
  generating: { id: "gallery.generating", defaultMessage: "Generating…" },
});

/**
 * A thumbnail that fades in once loaded. Hovering reveals the same actions as the generate
 * thumbnails: open in the OS default app, reveal in the file explorer, and delete. In multi-select
 * mode the whole cell becomes a toggle (checkbox), and the hover actions are hidden.
 */
function Thumb({ item, onOpen, onDelete, selectMode, selected, onToggleSelect }) {
  const intl = useIntl();
  const [loaded, setLoaded] = useState(false);
  const label = promptText(item) || item.file;
  const onDisk = isOutputFile(item.path);
  return (
    <div className={`g-cell${selected ? " is-selected" : ""}`}>
      <button
        className="g-open"
        onClick={() => (selectMode ? onToggleSelect(item) : onOpen(item))}
        title={label}
        aria-label={intl.formatMessage(selectMode ? msgs.selectAria : msgs.openAria, { label })}
        aria-pressed={selectMode ? selected : undefined}
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
      {selectMode && (
        <span className={`g-check${selected ? " on" : ""}`} aria-hidden="true">
          {selected ? "✓" : ""}
        </span>
      )}
      {!selectMode && (
        <div className="img-actions">
          {onDisk && (
            <>
              <button
                title={intl.formatMessage(msgs.openDefault)}
                onClick={() => openImageFile(item.path)}
              >
                ↗
              </button>
              <button
                title={intl.formatMessage(msgs.reveal)}
                onClick={() => revealImageFile(item.path)}
              >
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
      )}
    </div>
  );
}

/**
 * A busy placeholder cell for an image that's generating right now (from the gallery's prompt box).
 * It shows a shimmer + spinner and the prompt text, and is replaced by the real thumbnail once the
 * finished image lands in the feed.
 */
function PlaceholderCell({ label }) {
  const intl = useIntl();
  return (
    <div className="g-cell is-placeholder" aria-hidden="true">
      <div className="g-ph-shimmer" />
      <div className="g-ph-spin" />
      <span className="g-cell-cap g-ph-cap">{label || intl.formatMessage(msgs.generating)}</span>
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
 * @param {Function} [props.onDeleteMany] `(paths)` — mass-delete images (+ sidecars) from disk.
 * @param {object[]} [props.pending] Live placeholder descriptors `{ id, label }` for in-flight gens.
 * @param {import('react').ReactNode} [props.composer] A slot rendered above the header (the box).
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
  onDeleteMany,
  pending = [],
  composer = null,
}) {
  const intl = useIntl();
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => searchHaystack(it).includes(q)) : items),
    [items, q],
  );

  // --- Multi-select state ---
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // item.path values
  const canSelect = typeof onDeleteMany === "function";

  // Prune the selection when the feed changes (deleted/rescanned) so the count never counts ghosts.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const live = new Set(items.map((i) => i.path));
      const next = new Set([...prev].filter((p) => live.has(p)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleSelect = (item) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      return next;
    });
  const selectAllFiltered = () => setSelected(new Set(filtered.map((i) => i.path)));
  const clearSelection = () => setSelected(new Set());
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  async function deleteSelected() {
    const paths = [...selected];
    if (!paths.length) return;
    // Clear the selection only when the delete actually happened — `onDeleteMany` returns false when
    // the user cancels the confirm dialog, in which case the selection should stay put.
    const deleted = await onDeleteMany(paths);
    if (deleted === false) return;
    setSelected(new Set());
  }

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
  // the header wrapping on narrow screens, which shifts the grid's top). Also re-run when the
  // pending row or selection bar appears/disappears (they shift the grid's top).
  useLayoutEffect(() => {
    measure();
    const sc = scrollerRef.current;
    if (!sc || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(sc);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, pending.length, selectMode]);

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

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `${CELL}px`,
    gap: `${GAP}px`,
  };
  // "All selected" must be judged against the currently-filtered items — a raw size compare is wrong
  // when the selection still holds items from a previous filter.
  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.path));

  return (
    <div className="gallery-view" ref={scrollerRef} onScroll={onScroll}>
      <div className="g-inner">
        {composer}
        <div className="g-head">
          <div className="g-head-left">
            <h2 className="g-title">{intl.formatMessage(msgs.title)}</h2>
            <span className="g-count" aria-live="polite">
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
              type="search"
              placeholder={intl.formatMessage(msgs.searchPlaceholder)}
              aria-label={intl.formatMessage(msgs.searchAria)}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            {canSelect && !selectMode && (
              <button
                className="link-btn"
                onClick={() => setSelectMode(true)}
                title={intl.formatMessage(msgs.selectTitle)}
              >
                {intl.formatMessage(msgs.select)}
              </button>
            )}
            <button
              className="link-btn"
              onClick={onRefresh}
              title={intl.formatMessage(msgs.rescanTitle)}
            >
              {intl.formatMessage(msgs.refresh)}
            </button>
          </div>
        </div>

        {/* Selection action bar — only in multi-select mode. */}
        {selectMode && (
          <div
            className="g-select-bar"
            role="toolbar"
            aria-label={intl.formatMessage(msgs.selectionBarAria)}
          >
            <span className="g-select-count">
              {intl.formatMessage(msgs.selectedCount, { count: selected.size })}
            </span>
            <div className="grow" />
            <button
              className="link-btn"
              onClick={selectAllFiltered}
              disabled={filtered.length === 0 || allSelected}
            >
              {intl.formatMessage(msgs.selectAll)}
            </button>
            <button className="link-btn" onClick={clearSelection} disabled={selected.size === 0}>
              {intl.formatMessage(msgs.clearSelection)}
            </button>
            <button
              className="btn-destructive"
              onClick={deleteSelected}
              disabled={selected.size === 0}
            >
              {intl.formatMessage(msgs.deleteSelected, { count: selected.size })}
            </button>
            <button className="link-btn" onClick={exitSelect} title={intl.formatMessage(msgs.doneSelecting)}>
              {intl.formatMessage(msgs.done)}
            </button>
          </div>
        )}

        {!loading && items.length === 0 && pending.length === 0 && (
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

        {!loading && items.length > 0 && filtered.length === 0 && pending.length === 0 && (
          <div className="g-empty">
            <p>{intl.formatMessage(msgs.noMatch, { query })}</p>
          </div>
        )}

        {/* Live placeholders for in-flight generations — a small, non-virtualized row at the top. */}
        {pending.length > 0 && (
          <div className="g-grid g-grid-pending" style={gridStyle}>
            {pending.map((p) => (
              <PlaceholderCell key={p.id} label={p.label} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="g-grid-window" ref={gridRef} style={{ height: totalHeight }}>
            <div className="g-grid" style={{ transform: `translateY(${topPad}px)`, ...gridStyle }}>
              {windowItems.map((item) => (
                <Thumb
                  key={item.path}
                  item={item}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  selectMode={selectMode}
                  selected={selected.has(item.path)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
