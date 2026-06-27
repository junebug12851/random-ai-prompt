/**
 * The photo gallery grid — a browseable feed of every image saved to `output/`, each paired with
 * its `.json` metadata sidecar. A masonry-style grid of lazy-loaded thumbnails with a keyword
 * search box; clicking a thumbnail opens it in the single-image view (a sibling top-level view).
 *
 * This is a controlled component: the feed (`items`), loading flag, and search `query` live in
 * `App` so the gallery keeps its place when you switch tabs (the view stays mounted, just hidden).
 * Local-only: the feed needs the dev server's filesystem access, so a static/online build passes an
 * empty list and the grid shows an explanatory note.
 * @module gui/components/Gallery
 */
import { useMemo, useState } from "react";
import { searchHaystack, promptText } from "../lib/gallery.js";

/** A thumbnail that fades in once loaded and spans wide/tall by its natural aspect ratio. */
function Thumb({ item, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const [shape, setShape] = useState(""); // "" | "wide" | "tall"
  const label = promptText(item) || item.file;
  return (
    <button className={`g-cell${shape ? " " + shape : ""}`} onClick={() => onOpen(item)} title={label}>
      <img
        src={item.path}
        alt={label}
        loading="lazy"
        className={`g-img${loaded ? " loaded" : ""}`}
        onLoad={(e) => {
          setLoaded(true);
          const { naturalWidth: w, naturalHeight: h } = e.target;
          if (w && h) setShape(w / h >= 1.6 ? "wide" : h / w >= 1.6 ? "tall" : "");
        }}
      />
      {promptText(item) && <span className="g-cell-cap">{promptText(item).slice(0, 120)}</span>}
    </button>
  );
}

/**
 * The photo gallery grid.
 * @param {object} props
 * @param {object[]} props.items The feed items (newest first).
 * @param {boolean} props.loading Whether the feed is still loading.
 * @param {string} props.query The current search query (lives in App).
 * @param {Function} props.onQueryChange `(value)`.
 * @param {Function} props.onOpen `(item)` — open an image in the single view.
 * @param {Function} props.onRefresh Re-scan the output folder.
 * @returns {JSX.Element}
 */
export default function Gallery({ items, loading, query, onQueryChange, onOpen, onRefresh }) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => searchHaystack(it).includes(q)) : items),
    [items, q],
  );

  return (
    <div className="gallery-view">
      <div className="g-inner">
        <div className="g-head">
          <div className="g-head-left">
            <h2 className="g-title">Photo gallery</h2>
            <span className="g-count">
              {loading ? "loading…" : `${items.length} image${items.length === 1 ? "" : "s"}`}
              {!loading && q && ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
            </span>
          </div>
          <div className="g-head-right">
            <input
              className="g-search"
              placeholder="Search prompts, DPL, provider…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <button className="link-btn" onClick={onRefresh} title="Rescan the output folder">
              Refresh
            </button>
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div className="g-empty">
            <p>No images yet.</p>
            <p className="g-empty-sub">
              Generate some images and they'll appear here, read straight from your{" "}
              <code>output/</code> folder. (The gallery needs the local dev server — a static build
              has no folder to read.)
            </p>
          </div>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="g-empty">
            <p>No images match “{query}”.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="g-grid">
            {filtered.map((item) => (
              <Thumb key={item.path} item={item} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
