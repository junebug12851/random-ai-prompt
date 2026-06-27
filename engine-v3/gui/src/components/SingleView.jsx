/**
 * The single-image view — a dedicated full page for one saved image and its sidecar, promoted to a
 * top-level view (its own header tab) alongside Generate and Gallery. Sticky image on the left;
 * on the right the prompt and negative each in their DPL / engine-roll / AI-translation / sent
 * layers, a curated details table over the full settings snapshot + raw JSON, a clickable keyword
 * cloud, prev/next navigation across the feed, and actions (open / reveal / download PNG /
 * convert-&-download via ImageMagick / delete).
 *
 * State lives in `App` (the current image, the feed) so the view keeps its place when you switch
 * tabs. It stays mounted but hidden when inactive, so keyboard nav is gated on `active`.
 * @module gui/components/SingleView
 */
import { useEffect, useMemo } from "react";
import { promptText, promptLayers, negativeLayers } from "../lib/gallery.js";
import { convertUrl } from "../lib/magick.js";
import { isOutputFile, openImageFile, revealImageFile } from "../lib/output.js";

/** A labeled, copyable block of prompt/negative text (skipped when empty). */
function TextRow({ label, value, mono, accent }) {
  if (!value) return null;
  const copy = () => navigator.clipboard?.writeText(String(value)).catch(() => {});
  return (
    <div className={`g-text-row${accent ? " accent" : ""}`}>
      <div className="g-text-head">
        <span className="g-text-label">{label}</span>
        <button className="g-copy" onClick={copy}>
          copy
        </button>
      </div>
      <p className={`g-text-val${mono ? " mono" : ""}`}>{value}</p>
    </div>
  );
}

/** The prompt (or negative) card: its layers, most-relevant first, dupes collapsed. */
function PromptCard({ title, layers }) {
  if (!layers.final && !layers.ai && !layers.roll && !layers.dpl) return null;
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
 * The single-image view.
 * @param {object} props
 * @param {object[]} props.items The feed (drives prev/next).
 * @param {object|null} props.current The image being shown.
 * @param {{available: boolean, formats: string[]}} props.magick ImageMagick capability.
 * @param {boolean} props.active Whether this view is the visible one (gates keyboard nav).
 * @param {string} props.returnLabel Label for the Back button target (e.g. "Generate").
 * @param {Function} props.onBack Leave the single view.
 * @param {Function} props.onNavigate `(item)` — show another image (prev/next).
 * @param {Function} props.onDelete `(item)`.
 * @param {Function} props.onSearch `(term)` — search the gallery for a keyword.
 * @returns {JSX.Element}
 */
export default function SingleView({
  items,
  current,
  magick,
  active,
  returnLabel,
  onBack,
  onNavigate,
  onDelete,
  onSearch,
}) {
  const index = current ? items.findIndex((it) => it.path === current.path) : -1;
  const total = items.length;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;

  useEffect(() => {
    if (!active || !current) return undefined;
    const onKey = (e) => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(items[index - 1]);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(items[index + 1]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, current, items, index, hasPrev, hasNext, onBack, onNavigate]);

  if (!current) {
    return (
      <div className="gallery-view">
        <div className="g-inner">
          <div className="g-empty">
            <p>No image loaded.</p>
            <p className="g-empty-sub">
              Generate an image or open one from the gallery and it'll show here in full.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const item = current;
  const m = item.meta || {};
  const onDisk = isOutputFile(item.path);
  const p = promptLayers(m);
  const n = negativeLayers(m);
  const s = m.settings || {};

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
  const shownKeys = new Set([
    "width", "height", "model", "modelName", "checkpoint", "sd_model", "sd_model_hash",
    "sampler", "samplerName", "sampler_name", "scheduler", "steps", "numSteps", "cfg",
    "cfgScale", "cfg_scale", "guidance", "guidanceScale", "seed", "negativePrompt", "prompt", "mode",
  ]);
  const restSettings = Object.entries(s).filter(
    ([k, v]) => !shownKeys.has(k) && v !== null && v !== "" && typeof v !== "object",
  );

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
    <div className="gallery-view">
      <div className="g-inner">
        <div className="g-single">
          <div className="g-single-bar">
            <button className="g-back" onClick={onBack} title="Back (Esc)">
              ← Back to {returnLabel || "gallery"}
            </button>
            <div className="g-single-nav">
              <button
                onClick={() => onNavigate(items[index - 1])}
                disabled={!hasPrev}
                title="Previous image (←)"
              >
                ← Prev
              </button>
              {index >= 0 && (
                <span className="g-single-pos">
                  {index + 1} / {total}
                </span>
              )}
              <button
                onClick={() => onNavigate(items[index + 1])}
                disabled={!hasNext}
                title="Next image (→)"
              >
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
                    <select
                      className="g-convert"
                      defaultValue=""
                      onChange={onConvert}
                      title="Convert & download"
                    >
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
      </div>
    </div>
  );
}
