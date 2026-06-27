/**
 * The photo gallery — a browseable feed of every image saved to `output/`, each paired with its
 * `.json` metadata sidecar (how it was made). A masonry-style grid of lazy-loaded thumbnails with
 * a keyword search box; clicking a thumbnail opens a detail view showing the full record (prompt,
 * the deterministic engine roll, the AI translation, the DPL, the negative, and the provider +
 * full settings snapshot), with copy / open / reveal / delete actions. Inspired by the v1-2 feed.
 *
 * Local-only: the feed needs the dev server's filesystem access, so a static/online build shows an
 * empty gallery with an explanatory note rather than an error.
 * @module gui/components/Gallery
 */
import { useEffect, useMemo, useState } from "react";
import { fetchGallery, searchHaystack } from "../lib/gallery.js";
import {
  isOutputFile,
  deleteImageFile,
  openImageFile,
  revealImageFile,
} from "../lib/output.js";

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
      {item.meta?.prompt && (
        <span className="g-cell-cap">{item.meta.prompt.slice(0, 120)}</span>
      )}
    </button>
  );
}

/** A labeled, click-to-copy metadata row in the detail view (skipped when the value is empty). */
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

/** The full-screen detail view for one image and its sidecar. */
function Detail({ item, onClose, onDelete }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = item.meta || {};
  const onDisk = isOutputFile(item.path);
  const settingsEntries = m.settings
    ? Object.entries(m.settings).filter(
        ([, v]) => v !== undefined && v !== null && v !== "" && typeof v !== "object",
      )
    : [];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="g-detail" role="dialog" aria-modal="true" aria-label="Image details">
        <button className="g-detail-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="g-detail-img">
          <a href={item.path} target="_blank" rel="noreferrer" title="Open full image in a new tab">
            <img src={item.path} alt={m.prompt || item.file} />
          </a>
        </div>
        <div className="g-detail-meta">
          <h2 className="g-detail-title">Image details</h2>
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
            <details className="g-settings">
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
              <button className="btn-danger" onClick={() => onDelete(item)} title="Delete from disk">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
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
  const [active, setActive] = useState(null); // the item open in the detail view

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

  // Delete an image (+ its sidecar) from disk, then drop it from the grid and close the detail.
  async function remove(item) {
    if (!confirm("Delete this image and its metadata from disk? This can't be undone.")) return;
    await deleteImageFile(item.path);
    setItems((list) => list.filter((it) => it.path !== item.path));
    setActive((a) => (a && a.path === item.path ? null : a));
  }

  return (
    <div className="gallery-view">
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
            <Thumb key={item.path} item={item} onOpen={setActive} />
          ))}
        </div>
      )}

      {active && <Detail item={active} onClose={() => setActive(null)} onDelete={remove} />}
    </div>
  );
}
