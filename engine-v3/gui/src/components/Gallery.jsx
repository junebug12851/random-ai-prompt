/**
 * The photo gallery — a browseable feed of every image saved to `output/`, each paired with its
 * `.json` metadata sidecar (how it was made). A masonry-style grid of lazy-loaded thumbnails with
 * a keyword search box; clicking a thumbnail opens a dedicated **single-image page** (not a modal)
 * that replaces the grid and shows the full record (prompt, the deterministic engine roll, the AI
 * translation, the DPL, the negative, and the provider + full settings snapshot), with prev/next
 * navigation and copy / open / reveal / delete actions. Inspired by the v1-2 feed + its `/single`
 * page.
 *
 * Local-only: the feed needs the dev server's filesystem access, so a static/online build shows an
 * empty gallery with an explanatory note rather than an error.
 * @module gui/components/Gallery
 */
import { useEffect, useMemo, useState } from "react";
import { fetchGallery, searchHaystack } from "../lib/gallery.js";
import { isOutputFile, deleteImageFile, openImageFile, revealImageFile } from "../lib/output.js";

/** A thumbnail that fades in once loaded and spans wide/tall by its natural aspect ratio. */
function Thumb({ item, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const [shape, setShape] = useState(""); // "" | "wide" | "tall"
  return (
    <button
      className={`g-cell${shape ? " " + shape : ""}`}
      onClick={() => onOpen(item)}
      title={item.meta?.prompt || item.file}
    >
      <img
        src={item.path}
        alt={item.meta?.prompt || item.file}
        loading="lazy"
        className={`g-img${loaded ? " loaded" : ""}`}
        onLoad={(e) => {
          setLoaded(true);
          const { naturalWidth: w, naturalHeight: h } = e.target;
          if (w && h) setShape(w / h >= 1.6 ? "wide" : h / w >= 1.6 ? "tall" : "");
        }}
      />
      {item.meta?.prompt && <span className="g-cell-cap">{item.meta.prompt.slice(0, 120)}</span>}
    </button>
  );
}

/** A labeled, click-to-copy metadata row in the single view (skipped when the value is empty). */
function MetaRow({ label, value, mono }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="g-meta-row">
      <span className="g-meta-label">{label}</span>
      <code
        className={`g-meta-val${mono ? " mono" : ""}`}
        title="Click to copy"
        onClick={() => navigator.clipboard?.writeText(String(value)).catch(() => {})}
      >
        {String(value)}
      </code>
    </div>
  );
}

/**
 * The dedicated single-image page for one image and its sidecar. Renders in place of the grid
 * (a real page, not an overlay) with Back + prev/next navigation and the full metadata record.
 */
function Single({ item, index, total, onBack, onPrev, onNext, onDelete }) {
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;

  // Keyboard: Escape goes back; arrows page through the feed.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, onPrev, onNext, hasPrev, hasNext]);

  const m = item.meta || {};
  const onDisk = isOutputFile(item.path);
  const settingsEntries = m.settings
    ? Object.entries(m.settings).filter(
        ([, v]) => v !== undefined && v !== null && v !== "" && typeof v !== "object",
      )
    : [];

  return (
    <div className="g-single">
      <div className="g-single-bar">
        <button className="g-back" onClick={onBack} title="Back to the gallery (Esc)">
          ← Back to gallery
        </button>
        <div className="g-single-nav">
          <button onClick={onPrev} disabled={!hasPrev} title="Previous image (←)">
            ← Prev
          </button>
          {index >= 0 && (
            <span className="g-single-pos">
              {index + 1} / {total}
            </span>
          )}
          <button onClick={onNext} disabled={!hasNext} title="Next image (→)">
            Next →
          </button>
        </div>
      </div>

      <div className="g-single-body">
        <div className="g-single-img">
          <a href={item.path} target="_blank" rel="noreferrer" title="Open full image in a new tab">
            <img src={item.path} alt={m.prompt || item.file} />
          </a>
        </div>
        <div className="g-single-meta">
          <h2 className="g-single-title">Image details</h2>
          {!item.meta && (
            <p className="g-detail-note">
              No metadata sidecar was found for this image — it may pre-date sidecars or its{" "}
              <code>.json</code> file was removed.
            </p>
          )}
          <MetaRow label="Prompt (sent)" value={m.prompt} />
          <MetaRow label="Original roll" value={m.promptOriginal} />
          <MetaRow label="AI translation" value={m.aiTranslation} />
          <MetaRow label="DPL" value={m.dpl} mono />
          <MetaRow label="Negative" value={m.negativePrompt} />
          <MetaRow label="Provider" value={m.providerLabel || m.provider} />
          <MetaRow label="Saved" value={m.savedAt} />
          <MetaRow label="File" value={item.file} mono />

          {settingsEntries.length > 0 && (
            <details className="g-settings" open>
              <summary>Provider settings ({settingsEntries.length})</summary>
              <div className="g-settings-grid">
                {settingsEntries.map(([k, v]) => (
                  <MetaRow key={k} label={k} value={String(v)} />
                ))}
              </div>
            </details>
          )}

          {onDisk && (
            <div className="g-detail-actions">
              <button onClick={() => openImageFile(item.path)} title="Open in the default app">
                Open
              </button>
              <button onClick={() => revealImageFile(item.path)} title="Reveal in file explorer">
                Reveal
              </button>
              <a className="g-dl" href={item.path} download={item.file}>
                Download
              </a>
              <button
                className="btn-danger"
                onClick={() => onDelete(item)}
                title="Delete from disk"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The photo gallery view.
 * @returns {JSX.Element}
 */
export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // the item open in the single-image page

  async function load() {
    setLoading(true);
    setItems(await fetchGallery());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => searchHaystack(it).includes(q)) : items),
    [items, q],
  );

  // Where the open image sits in the (search-filtered) feed — drives prev/next.
  const index = selected ? filtered.findIndex((it) => it.path === selected.path) : -1;

  // Delete an image (+ its sidecar) from disk. In the single view, land on a neighbor (or back to
  // the grid when it was the last one); in the grid, just drop it.
  async function remove(item) {
    if (!confirm("Delete this image and its metadata from disk? This can't be undone.")) return;
    await deleteImageFile(item.path);
    const i = filtered.findIndex((it) => it.path === item.path);
    const neighbor = filtered[i + 1] || filtered[i - 1] || null;
    setItems((list) => list.filter((it) => it.path !== item.path));
    setSelected((s) => (s && s.path === item.path ? neighbor : s));
  }

  return (
    <div className="gallery-view">
      <div className="g-inner">
        {selected ? (
          <Single
            item={selected}
            index={index}
            total={filtered.length}
            onBack={() => setSelected(null)}
            onPrev={() => index > 0 && setSelected(filtered[index - 1])}
            onNext={() => index >= 0 && index < filtered.length - 1 && setSelected(filtered[index + 1])}
            onDelete={remove}
          />
        ) : (
          <>
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
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="link-btn" onClick={load} title="Rescan the output folder">
                  Refresh
                </button>
              </div>
            </div>

            {!loading && items.length === 0 && (
              <div className="g-empty">
                <p>No images yet.</p>
                <p className="g-empty-sub">
                  Generate some images and they'll appear here, read straight from your{" "}
                  <code>output/</code> folder. (The gallery needs the local dev server — a static
                  build has no folder to read.)
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
                  <Thumb key={item.path} item={item} onOpen={setSelected} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
