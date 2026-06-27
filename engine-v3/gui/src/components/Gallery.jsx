/**
 * The photo gallery — a browseable feed of every image saved to `output/`, each paired with its
 * `.json` metadata sidecar (how it was made). A masonry-style grid of lazy-loaded thumbnails with
 * a keyword search box; clicking a thumbnail opens a dedicated **single-image page** (not a modal)
 * that replaces the grid and shows the full record: the prompt and negative each in their DPL /
 * engine-roll / AI-translation / sent-final layers, a curated details panel (provider, model,
 * sampler, size, seed…) over the full settings snapshot, a clickable keyword cloud, prev/next
 * navigation, and actions (open / reveal / download PNG / convert-&-download via ImageMagick /
 * delete). Inspired by the v1-2 feed + its `/single` page, rebuilt for v3's richer metadata.
 *
 * Local-only: the feed (and ImageMagick conversion) need the dev server's filesystem access, so a
 * static/online build shows an empty gallery with an explanatory note rather than an error.
 * @module gui/components/Gallery
 */
import { useEffect, useMemo, useState } from "react";
import {
  fetchGallery,
  searchHaystack,
  promptText,
  promptLayers,
  negativeLayers,
} from "../lib/gallery.js";
import { fetchMagick, convertUrl } from "../lib/magick.js";
import { isOutputFile, deleteImageFile, openImageFile, revealImageFile } from "../lib/output.js";

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

/** A labeled, copyable block of prompt/negative text (skipped when empty). */
function TextRow({ label, value, mono, accent }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = () => {
    navigator.clipboard?.writeText(String(value)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <div className={`g-text-row${accent ? " accent" : ""}`}>
      <div className="g-text-head">
        <span className="g-text-label">{label}</span>
        <button className="g-copy" onClick={copy}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <p className={`g-text-val${mono ? " mono" : ""}`}>{value}</p>
    </div>
  );
}

/** The prompt (or negative) card: its four layers, most-relevant first. */
function PromptCard({ title, layers }) {
  if (!layers.final && !layers.ai && !layers.roll && !layers.dpl) return null;
  // Don't repeat the same string twice (e.g. when no AI translation ran, final === roll).
  const showRoll = layers.roll && layers.roll !== layers.final;
  const showAi = layers.ai && layers.ai !== layers.final;
  return (
    <section className="g-card">
      <h3 className="g-card-title">{title}</h3>
      <TextRow label="Sent to model" value={layers.final} accent />
      {showAi && <TextRow label="AI translation" value={layers.ai} />}
      {showRoll && <TextRow label="Engine roll" value={layers.roll} />}
      <TextRow label="DPL source" value={layers.dpl} mono />
    </section>
  );
}

/** One row in the details table (skipped when empty). */
function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="g-detail-row">
      <span className="g-detail-key">{label}</span>
      <span className="g-detail-value">{String(value)}</span>
    </div>
  );
}

// First present value among several possible setting keys (providers name things differently).
const pick = (s, ...keys) => {
  for (const k of keys) if (s && s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
  return undefined;
};

/** The clickable keyword cloud, built from the sent prompt's comma-separated tags. */
function KeywordCloud({ text, onSearch }) {
  const tags = useMemo(() => {
    const seen = new Set();
    return (text || "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => {
        const k = t.toLowerCase();
        if (!t || t.length > 40 || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 60);
  }, [text]);
  if (tags.length < 2) return null;
  return (
    <section className="g-card">
      <h3 className="g-card-title">Keywords</h3>
      <div className="g-cloud">
        {tags.map((t, i) => (
          <button key={i} className="g-cloud-chip" onClick={() => onSearch(t)} title={`Find “${t}”`}>
            {t}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The dedicated single-image page for one image and its sidecar. Renders in place of the grid
 * (a real page, not an overlay) with Back + prev/next navigation and the full metadata record.
 */
function Single({ item, index, total, magick, onBack, onPrev, onNext, onDelete, onSearch }) {
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "SELECT") return;
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, onPrev, onNext, hasPrev, hasNext]);

  const m = item.meta || {};
  const onDisk = isOutputFile(item.path);
  const p = promptLayers(m);
  const n = negativeLayers(m);
  const s = m.settings || {};

  // Curated headline details (graceful when a provider doesn't report a field).
  const size =
    pick(s, "width") && pick(s, "height") ? `${pick(s, "width")}×${pick(s, "height")}` : undefined;
  const saved = m.savedAt ? new Date(m.savedAt).toLocaleString() : undefined;
  const details = [
    ["Provider", m.providerLabel || m.provider],
    ["Model", pick(s, "model", "modelName", "checkpoint", "sd_model", "sd_model_hash")],
    ["Sampler", pick(s, "sampler", "samplerName", "sampler_name", "scheduler")],
    ["Steps", pick(s, "steps", "numSteps")],
    ["CFG", pick(s, "cfg", "cfgScale", "cfg_scale", "guidance", "guidanceScale")],
    ["Size", size],
    ["Seed", pick(s, "seed")],
    ["Saved", saved],
    ["File", item.file],
  ];

  // Everything else in the settings snapshot, for the collapsible "all settings".
  const shownKeys = new Set([
    "width", "height", "model", "modelName", "checkpoint", "sd_model", "sd_model_hash",
    "sampler", "samplerName", "sampler_name", "scheduler", "steps", "numSteps", "cfg",
    "cfgScale", "cfg_scale", "guidance", "guidanceScale", "seed", "negativePrompt", "prompt", "mode",
  ]);
  const restSettings = Object.entries(s).filter(
    ([k, v]) => !shownKeys.has(k) && v !== null && v !== "" && typeof v !== "object",
  );

  // Convert-&-download: pick a format, get the file, reset the menu.
  const onConvert = (e) => {
    const fmt = e.target.value;
    e.target.selectedIndex = 0;
    if (!fmt) return;
    const a = document.createElement("a");
    a.href = convertUrl(item.file, fmt);
    a.download = `${item.name || item.file}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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
            <img src={item.path} alt={promptText(item) || item.file} />
          </a>
        </div>

        <div className="g-single-meta">
          {onDisk && (
            <div className="g-actions">
              <button onClick={() => openImageFile(item.path)} title="Open in the default app">
                Open
              </button>
              <button onClick={() => revealImageFile(item.path)} title="Reveal in file explorer">
                Reveal
              </button>
              <a className="g-action-link" href={item.path} download={item.file}>
                Download PNG
              </a>
              {magick.available && magick.formats.length > 0 && (
                <select className="g-convert" defaultValue="" onChange={onConvert} title="Convert & download">
                  <option value="">Convert &amp; download…</option>
                  {magick.formats.map((f) => (
                    <option key={f} value={f}>
                      {f.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
              <button className="g-danger" onClick={() => onDelete(item)} title="Delete from disk">
                Delete
              </button>
            </div>
          )}

          {!item.meta && (
            <p className="g-note">
              No metadata sidecar was found for this image — it may pre-date sidecars or its{" "}
              <code>.json</code> file was removed.
            </p>
          )}

          <PromptCard title="Prompt" layers={p} />
          <PromptCard title="Negative prompt" layers={n} />

          {details.some(([, v]) => v !== undefined && v !== null && v !== "") && (
            <section className="g-card">
              <h3 className="g-card-title">Details</h3>
              <div className="g-detail-table">
                {details.map(([k, v]) => (
                  <DetailRow key={k} label={k} value={v} />
                ))}
              </div>
              {restSettings.length > 0 && (
                <details className="g-more">
                  <summary>All settings ({restSettings.length})</summary>
                  <div className="g-detail-table">
                    {restSettings.map(([k, v]) => (
                      <DetailRow key={k} label={k} value={String(v)} />
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          <KeywordCloud text={p.final || p.roll} onSearch={onSearch} />

          {item.meta && (
            <details className="g-more">
              <summary>Raw metadata (JSON)</summary>
              <pre className="g-json">{JSON.stringify(item.meta, null, 2)}</pre>
            </details>
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
  const [magick, setMagick] = useState({ available: false, formats: [] });

  async function load() {
    setLoading(true);
    setItems(await fetchGallery());
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetchMagick().then(setMagick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => searchHaystack(it).includes(q)) : items),
    [items, q],
  );

  const index = selected ? filtered.findIndex((it) => it.path === selected.path) : -1;

  // Search from a keyword chip: filter the grid by that term and return to it.
  function searchFor(term) {
    setQuery(term);
    setSelected(null);
  }

  // Delete an image (+ its sidecar) from disk. In the single view, land on a neighbor (or back to
  // the grid when it was the last one); in the grid, just drop it.
  async function remove(item) {
    if (!confirm("Delete this image and its metadata from disk? This can't be undone.")) return;
    await deleteImageFile(item.path);
    const i = filtered.findIndex((it) => it.path === item.path);
    const neighbor = filtered[i + 1] || filtered[i - 1] || null;
    setItems((list) => list.filter((it) => it.path !== item.path));
    setSelected((sel) => (sel && sel.path === item.path ? neighbor : sel));
  }

  return (
    <div className="gallery-view">
      <div className="g-inner">
        {selected ? (
          <Single
            item={selected}
            index={index}
            total={filtered.length}
            magick={magick}
            onBack={() => setSelected(null)}
            onPrev={() => index > 0 && setSelected(filtered[index - 1])}
            onNext={() =>
              index >= 0 && index < filtered.length - 1 && setSelected(filtered[index + 1])
            }
            onDelete={remove}
            onSearch={searchFor}
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
