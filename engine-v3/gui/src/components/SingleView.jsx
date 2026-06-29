/**
 * The single-image view — a dedicated full page for one saved image and its sidecar, promoted to a
 * top-level view (its own header tab) alongside Generate and Gallery. Sticky image on the left with
 * its Re-Rolls / Variations / Resizes strips beneath it; on the right the prompt and negative each
 * in their DPL / engine-roll / AI-translation / sent layers (with inline re-roll / make-variation
 * actions), a curated details table (toggleable to a syntax-highlighted raw-JSON view) with
 * Markdown / JSON copy, a clickable keyword cloud, prev/next navigation, and the file actions
 * (open / reveal / download / convert / resize / delete).
 *
 * Two v1-2 features live here: **re-roll / variation** (regenerate a fresh image from a captured
 * prompt layer, new seed) and **ancestry** (each derived image keeps its parent's id; the feed scan
 * rebuilds the reverse child list). Re-roll / variation / resize don't navigate away — a live
 * placeholder appears in the matching strip below the image and fills in when the new image lands.
 *
 * State lives in `App` (the current image, the feed, in-flight derivations) so the view keeps its
 * place when you switch tabs. It stays mounted but hidden when inactive, so keyboard nav is gated on
 * `active`.
 * @module gui/components/SingleView
 */
import { useEffect, useMemo, useState } from "react";
import { useIntl, defineMessages, FormattedMessage } from "react-intl";
import { promptText, promptLayers, negativeLayers } from "../lib/gallery.js";
import { convertUrl } from "../lib/magick.js";
import {
  isOutputFile,
  openImageFile,
  revealImageFile,
  updateImageMeta,
} from "../lib/output.js";
import { parseKeywords, normalizeKeywordList } from "../lib/keywords.js";
import { rewritePrompt } from "../lib/rewrite.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { getProvider, providers } from "../lib/providers/index.js";
import { canDerive, hasSource, RESIZE_SCALES } from "../lib/derive.js";

const msgs = defineMessages({
  copy: { id: "single.copy", defaultMessage: "copy" },
  reroll: { id: "single.rerollAction", defaultMessage: "re-roll" },
  vary: { id: "single.varyAction", defaultMessage: "vary" },
  sentToModel: { id: "single.sentToModel", defaultMessage: "Sent to model" },
  aiTranslation: { id: "single.aiTranslation", defaultMessage: "AI translation" },
  engineRoll: { id: "single.engineRoll", defaultMessage: "Engine roll" },
  dplSource: { id: "single.dplSource", defaultMessage: "DPL source" },
  noKey: {
    id: "single.noKey",
    defaultMessage: "{provider} has no API key — add one on the Generate screen.",
  },
  providerFallback: { id: "single.providerFallback", defaultMessage: "The rewrite provider" },
  noKeywords: { id: "single.noKeywords", defaultMessage: "The model returned no usable keywords." },
  saveFailed: {
    id: "single.saveFailed",
    defaultMessage: "Couldn't save keywords (no local server?).",
  },
  rebuildFailed: { id: "single.rebuildFailed", defaultMessage: "Keyword rebuild failed: {error}" },
  keywords: { id: "single.keywords", defaultMessage: "Keywords" },
  keywordsEdited: { id: "single.keywordsEdited", defaultMessage: "Keywords · edited" },
  rebuildTitle: {
    id: "single.rebuildTitle",
    defaultMessage:
      "Send the prompt to the AI, break it into a clean alphabetical keyword list, and save it over these",
  },
  rebuilding: { id: "single.rebuilding", defaultMessage: "Rebuilding…" },
  rebuild: { id: "single.rebuild", defaultMessage: "Rebuild with AI" },
  find: { id: "single.find", defaultMessage: "Find “{term}”" },
  noImage: { id: "single.noImage", defaultMessage: "No image loaded." },
  noImageSub: {
    id: "single.noImageSub",
    defaultMessage: "Generate an image or open one from the gallery and it'll show here in full.",
  },
  backTitle: { id: "single.backTitle", defaultMessage: "Back (Esc)" },
  back: { id: "single.back", defaultMessage: "← Back to {target}" },
  galleryFallback: { id: "single.galleryFallback", defaultMessage: "gallery" },
  prevTitle: { id: "single.prevTitle", defaultMessage: "Previous image (←)" },
  prev: { id: "single.prev", defaultMessage: "← Prev" },
  next: { id: "single.next", defaultMessage: "Next →" },
  nextTitle: { id: "single.nextTitle", defaultMessage: "Next image (→)" },
  openFull: { id: "single.openFull", defaultMessage: "Open full image in a new tab" },
  openDefault: { id: "single.openDefault", defaultMessage: "Open in the default app" },
  open: { id: "single.open", defaultMessage: "Open" },
  reveal: { id: "single.reveal", defaultMessage: "Reveal" },
  revealTitle: { id: "single.revealTitle", defaultMessage: "Reveal in file explorer" },
  downloadPng: { id: "single.downloadPng", defaultMessage: "Download PNG" },
  convertTitle: { id: "single.convertTitle", defaultMessage: "Convert & download" },
  convertOption: { id: "single.convertOption", defaultMessage: "Convert & download…" },
  convertLocked: {
    id: "single.convertLocked",
    defaultMessage: "Converting needs ImageMagick installed — it isn't, so this is locked",
  },
  needsMagickOpt: { id: "single.needsMagickOpt", defaultMessage: "Needs ImageMagick" },
  deleteTitle: { id: "single.deleteTitle", defaultMessage: "Delete from disk" },
  delete: { id: "single.delete", defaultMessage: "Delete" },
  details: { id: "single.details", defaultMessage: "Details" },
  viewRaw: { id: "single.viewRaw", defaultMessage: "View Raw" },
  viewTable: { id: "single.viewTable", defaultMessage: "View Table" },
  copyMd: { id: "single.copyMd", defaultMessage: "Copy as Markdown" },
  copyJson: { id: "single.copyJson", defaultMessage: "Copy as JSON" },
  copied: { id: "single.copiedGeneric", defaultMessage: "✓ Copied" },
  copyMdTitle: {
    id: "single.copyMdTitle",
    defaultMessage: "Copy the prompt, negative, and details as a Markdown block",
  },
  copyJsonTitle: {
    id: "single.copyJsonTitle",
    defaultMessage: "Copy the full raw metadata as JSON",
  },
  allSettings: { id: "single.allSettings", defaultMessage: "All settings ({count})" },
  promptTitle: { id: "single.promptTitle", defaultMessage: "Prompt" },
  negativeTitle: { id: "single.negativeTitle", defaultMessage: "Negative prompt" },
  dProvider: { id: "single.detail.provider", defaultMessage: "Provider" },
  dModel: { id: "single.detail.model", defaultMessage: "Model" },
  dSampler: { id: "single.detail.sampler", defaultMessage: "Sampler" },
  dSteps: { id: "single.detail.steps", defaultMessage: "Steps" },
  dCfg: { id: "single.detail.cfg", defaultMessage: "CFG" },
  dSize: { id: "single.detail.size", defaultMessage: "Size" },
  dSeed: { id: "single.detail.seed", defaultMessage: "Seed" },
  dSaved: { id: "single.detail.saved", defaultMessage: "Saved" },
  dFile: { id: "single.detail.file", defaultMessage: "File" },
  // Re-roll / variation
  rerollTitle: {
    id: "single.rerollTitle",
    defaultMessage: "Re-roll the recipe — a fresh random prompt from the DPL, with a new seed",
  },
  varyTitle: { id: "single.varyTitle", defaultMessage: "Make a variation from this layer (new seed)" },
  deriveLocked: {
    id: "single.deriveLocked",
    defaultMessage: "{provider} doesn't support seeds — re-roll & variations need seed control",
  },
  layerMissing: {
    id: "single.layerMissing",
    defaultMessage: "This image has no {layer} layer to vary from",
  },
  confirmReroll: {
    id: "single.confirmReroll",
    defaultMessage: "Re-roll from the DPL recipe? A new image is generated with a new seed.",
  },
  confirmVary: {
    id: "single.confirmVary",
    defaultMessage: "Make a variation from the {layer}? A new image is generated with a new seed.",
  },
  deriveError: { id: "single.deriveError", defaultMessage: "Couldn't make another: {error}" },
  // Strips + ancestry
  stripRerolls: { id: "single.stripRerolls", defaultMessage: "Re-Rolls" },
  stripVariations: { id: "single.stripVariations", defaultMessage: "Variations" },
  stripResizes: { id: "single.stripResizes", defaultMessage: "Resizes" },
  lineage: { id: "single.lineage", defaultMessage: "Lineage" },
  typeBase: { id: "single.typeBase", defaultMessage: "Base image" },
  typeReroll: { id: "single.typeReroll", defaultMessage: "Re-roll" },
  typeVariation: { id: "single.typeVariation", defaultMessage: "Variation" },
  typeResize: { id: "single.typeResize", defaultMessage: "Resize" },
  fromLayer: { id: "single.fromLayer", defaultMessage: "from {layer}" },
  parentLink: { id: "single.parentLink", defaultMessage: "↑ Parent" },
  parentTitle: { id: "single.parentTitle", defaultMessage: "Open the image this was made from" },
  layerDpl: { id: "single.layerDpl", defaultMessage: "DPL" },
  layerFinal: { id: "single.layerFinal", defaultMessage: "sent prompt" },
  layerAi: { id: "single.layerAi", defaultMessage: "translation" },
  layerRoll: { id: "single.layerRoll", defaultMessage: "original roll" },
  // Resize
  resizeOption: { id: "single.resizeOption", defaultMessage: "Resize…" },
  resizeTitle: { id: "single.resizeTitle", defaultMessage: "Resize into a new image" },
  resizeGroupMagick: { id: "single.resizeGroupMagick", defaultMessage: "ImageMagick" },
  resizeGroupAi: { id: "single.resizeGroupAi", defaultMessage: "AI" },
  resizeDown: { id: "single.resizeDown", defaultMessage: "{label} (downscale)" },
  resizeUp: { id: "single.resizeUp", defaultMessage: "{label} (upscale)" },
  resizeNeedsMagick: { id: "single.resizeNeedsMagick", defaultMessage: "{label} — needs ImageMagick" },
  resizeLocked: {
    id: "single.resizeLocked",
    defaultMessage: "Resizing needs ImageMagick installed — it isn't, so this is locked",
  },
  aiUpscale: { id: "single.aiUpscale", defaultMessage: "AI Upscale · {provider}" },
  aiNeedsKey: { id: "single.aiNeedsKey", defaultMessage: "{provider} — add a key to use" },
  aiUpscaleNone: {
    id: "single.aiUpscaleNone",
    defaultMessage: "AI Upscale — no provider added yet",
  },
});

// Human label for a derive source layer.
const layerMsg = { dpl: msgs.layerDpl, final: msgs.layerFinal, ai: msgs.layerAi, roll: msgs.layerRoll };
// Fraction glyphs for sub-1 resize factors.
const FRAC = { 0.25: "¼×", 0.5: "½×" };

/**
 * A labeled, copyable block of prompt/negative text (skipped when empty), with optional inline
 * actions (re-roll / make-variation) styled like the copy link.
 */
function TextRow({ label, value, mono, accent, extras }) {
  const intl = useIntl();
  if (!value) return null;
  const copy = () => navigator.clipboard?.writeText(String(value)).catch(() => {});
  return (
    <div className={`g-text-row${accent ? " accent" : ""}`}>
      <div className="g-text-head">
        <span className="g-text-label">{label}</span>
        <span className="g-text-acts">
          {(extras || []).map((a) => (
            <button
              key={a.key}
              className={`g-copy g-act${a.disabled ? " is-locked" : ""}`}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
            >
              {a.label}
              {a.disabled && <span aria-hidden="true"> 🔒</span>}
            </button>
          ))}
          <button className="g-copy" onClick={copy}>
            {intl.formatMessage(msgs.copy)}
          </button>
        </span>
      </div>
      <p className={`g-text-val${mono ? " mono" : ""}`}>{value}</p>
    </div>
  );
}

/** The prompt (or negative) card: its layers, most-relevant first, dupes collapsed. */
function PromptCard({ title, layers, extrasFor }) {
  const intl = useIntl();
  if (!layers.final && !layers.ai && !layers.roll && !layers.dpl) return null;
  const showRoll = layers.roll && layers.roll !== layers.final;
  const showAi = layers.ai && layers.ai !== layers.final;
  const ex = (key) => (extrasFor ? extrasFor(key) : []);
  return (
    <section className="g-card">
      <h3 className="g-card-title">{title}</h3>
      <TextRow label={intl.formatMessage(msgs.sentToModel)} value={layers.final} accent extras={ex("final")} />
      {showAi && <TextRow label={intl.formatMessage(msgs.aiTranslation)} value={layers.ai} extras={ex("ai")} />}
      {showRoll && <TextRow label={intl.formatMessage(msgs.engineRoll)} value={layers.roll} extras={ex("roll")} />}
      <TextRow label={intl.formatMessage(msgs.dplSource)} value={layers.dpl} mono extras={ex("dpl")} />
    </section>
  );
}

/** One row in the details table (skipped when empty). */
function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <tr className="g-detail-row">
      <th scope="row" className="g-detail-key">
        {label}
      </th>
      <td className="g-detail-value">{String(value)}</td>
    </tr>
  );
}

/** A `<table>` of label/value detail rows (empty rows skipped). */
function DetailTable({ rows }) {
  return (
    <table className="g-detail-table">
      <tbody>
        {rows.map(([k, v]) => (
          <DetailRow key={k} label={k} value={v} />
        ))}
      </tbody>
    </table>
  );
}

// First present value among several possible setting keys (providers name things differently).
const pick = (s, ...keys) => {
  for (const k of keys) if (s && s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
  return undefined;
};

// App-orchestration / sidecar-bookkeeping keys that should never appear in the "All settings"
// dump — so old sidecars (written before the snapshot was provider-scoped) stop leaking another
// provider's metadata into the table.
const REST_DROP = new Set([
  "provider", "providerLabel", "providerParams", "prompt", "negativePrompt", "promptCount",
  "locale", "includeAdult", "autoFix", "autoKeyword", "autoAddFx", "autoAddArtists",
  "rewriteProvider", "wrapper", "wrapperName", "wrapperParams", "useAutoSections", "keys", "mode",
  "parent", "derivedKind", "derivedSource", "savedAt", "file", "image",
]);

/** Build a Markdown block of the prompt, negative, and (present) detail rows. */
function toMarkdown(promptFinal, negFinal, rows) {
  const lines = [];
  if (promptFinal) lines.push(`**Prompt**: ${promptFinal}`, "");
  if (negFinal) lines.push(`**Negative prompt**: ${negFinal}`, "");
  const present = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (present.length) {
    lines.push("| Field | Value |", "| --- | --- |");
    for (const [k, v] of present) lines.push(`| ${k} | ${String(v).replace(/\|/g, "\\|")} |`);
    lines.push("");
  }
  lines.push(
    "Generated using [Random AI Prompt](https://github.com/junebug12851/random-ai-prompt)",
  );
  return lines.join("\n");
}

/** Wrap JSON tokens in classed spans for syntax highlighting (input is escaped first). */
function syntaxHighlightJson(json) {
  const esc = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "json-num";
      if (/^"/.test(m)) cls = /:$/.test(m) ? "json-key" : "json-str";
      else if (/true|false/.test(m)) cls = "json-bool";
      else if (/null/.test(m)) cls = "json-null";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

/** A copy-to-clipboard button with brief ✓ feedback (Markdown / JSON export). */
function CopyButton({ label, text, title }) {
  const intl = useIntl();
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      })
      .catch(() => {});
  };
  return (
    <button className="g-card-action" onClick={copy} title={title}>
      {done ? intl.formatMessage(msgs.copied) : label}
    </button>
  );
}

/**
 * The lineage header line: a type label (Base / Re-roll / Variation / Resize) and a link up to the
 * parent. The derived-child strips live below the image, not here.
 */
function LineageHead({ item, items, onNavigate }) {
  const intl = useIntl();
  const m = item.meta || {};
  const parentItem = m.parent ? items.find((it) => it.name === m.parent) : null;
  if (!m.parent && !(item.children && item.children.length)) return null;

  const typeMsg =
    m.derivedKind === "reroll"
      ? msgs.typeReroll
      : m.derivedKind === "resize"
        ? msgs.typeResize
        : m.derivedKind === "variation"
          ? msgs.typeVariation
          : msgs.typeBase;
  const srcMsg = layerMsg[m.derivedSource];

  return (
    <div className="g-lineage-head">
      <span className="g-lineage-type">
        {intl.formatMessage(typeMsg)}
        {m.parent && srcMsg && m.derivedKind !== "resize" && (
          <span className="g-lineage-from">
            {" "}
            {intl.formatMessage(msgs.fromLayer, { layer: intl.formatMessage(srcMsg) })}
          </span>
        )}
        {m.derivedKind === "resize" && m.resizeScale && (
          <span className="g-lineage-from"> ({m.resizeScale}×)</span>
        )}
      </span>
      {parentItem && (
        <button
          className="g-lineage-parent"
          onClick={() => onNavigate(parentItem)}
          title={intl.formatMessage(msgs.parentTitle)}
        >
          {intl.formatMessage(msgs.parentLink)}
        </button>
      )}
    </div>
  );
}

/**
 * The derived-child strips shown beneath the main image: Re-Rolls, Variations, Resizes. Each strip
 * lists that kind's children (clickable thumbnails) plus a live spinner placeholder per in-flight
 * derivation of that kind for this image. A strip is omitted when it has neither.
 */
function DerivedStrips({ item, items, derivations, onNavigate }) {
  const intl = useIntl();
  const groups = { reroll: [], variation: [], resize: [] };
  for (const c of item.children || []) if (groups[c.kind]) groups[c.kind].push(c);
  const pendingOf = (kind) =>
    derivations.filter((d) => d.parentPath === item.path && d.kind === kind).length;

  const strips = [
    ["reroll", msgs.stripRerolls],
    ["variation", msgs.stripVariations],
    ["resize", msgs.stripResizes],
  ];

  const rendered = strips
    .map(([kind, label]) => {
      const kids = groups[kind] || [];
      const pending = pendingOf(kind);
      if (!kids.length && !pending) return null;
      return (
        <div className="g-strip" key={kind}>
          <div className="g-strip-label">
            {intl.formatMessage(label)} <span className="g-strip-count">{kids.length}</span>
          </div>
          <div className="g-strip-row">
            {Array.from({ length: pending }).map((_, i) => (
              <div className="g-strip-thumb is-pending" key={`p-${i}`} aria-busy="true">
                <div className="g-pending-spinner small" aria-hidden="true" />
              </div>
            ))}
            {kids.map((c) => {
              const ci = items.find((it) => it.path === c.path);
              return (
                <button
                  key={c.path}
                  className="g-strip-thumb"
                  onClick={() => ci && onNavigate(ci)}
                >
                  <img src={c.path} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        </div>
      );
    })
    .filter(Boolean);

  if (!rendered.length) return null;
  return <div className="g-strips">{rendered}</div>;
}

/**
 * The clickable keyword cloud. Prefers a saved keyword list on the sidecar (`meta.keywords`);
 * otherwise it parses clean tags from the sent prompt. "Rebuild with AI" asks the rewrite provider
 * for a tidy tag list and saves it over the sidecar's set.
 * @param {object} props
 * @param {string} props.text The sent-to-model prompt text.
 * @param {string[]|null} props.saved A saved keyword list from the sidecar, or null.
 * @param {object} props.item The gallery item (for its served path / on-disk check).
 * @param {object} props.settings App settings (rewrite provider + key).
 * @param {Function} props.onSearch `(term)` — search the gallery for a keyword.
 * @param {Function} props.onSaved `(meta)` — a fresh sidecar after a save.
 * @returns {JSX.Element|null}
 */
function KeywordsCard({ text, saved, item, settings, onSearch, onSaved }) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tags = useMemo(() => {
    if (Array.isArray(saved) && saved.length) return saved.slice(0, 80);
    return parseKeywords(text).map((k) => k.display);
  }, [saved, text]);

  const rewriteId = settings?.rewriteProvider;
  const canRebuild =
    isOutputFile(item?.path) && rewriteId && rewriteId !== "none" && Boolean(text && text.trim());

  async function rebuild() {
    setError("");
    const key = effectiveKey(rewriteId, settings);
    if (!key) {
      setError(
        intl.formatMessage(msgs.noKey, {
          provider: getProvider(rewriteId)?.label || intl.formatMessage(msgs.providerFallback),
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const reply = await rewritePrompt({ providerId: rewriteId, prompt: text, key, mode: "keyword" });
      const keywords = normalizeKeywordList((reply || "").split(/[,\n]+/), { sort: true });
      if (!keywords.length) {
        setError(intl.formatMessage(msgs.noKeywords));
        return;
      }
      const meta = await updateImageMeta(item.path, { keywords });
      if (meta) onSaved?.(meta);
      else setError(intl.formatMessage(msgs.saveFailed));
    } catch (e) {
      setError(intl.formatMessage(msgs.rebuildFailed, { error: e.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }

  if (tags.length < 2 && !canRebuild) return null;

  return (
    <section className="g-card">
      <div className="g-card-head">
        <h3 className="g-card-title">
          {intl.formatMessage(
            Array.isArray(saved) && saved.length ? msgs.keywordsEdited : msgs.keywords,
          )}
        </h3>
        {canRebuild && (
          <button
            className="g-card-action"
            onClick={rebuild}
            disabled={busy}
            title={intl.formatMessage(msgs.rebuildTitle)}
          >
            {intl.formatMessage(busy ? msgs.rebuilding : msgs.rebuild)}
          </button>
        )}
      </div>
      {error && <p className="g-card-err">{error}</p>}
      {tags.length > 0 && (
        <div className="g-cloud">
          {tags.map((t, i) => (
            <button
              key={`${t}-${i}`}
              className="g-cloud-chip"
              onClick={() => onSearch(t)}
              title={intl.formatMessage(msgs.find, { term: t })}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The single-image view.
 * @param {object} props
 * @param {object[]} props.items The feed (drives prev/next + ancestry resolution).
 * @param {object|null} props.current The image being shown.
 * @param {{available: boolean, formats: string[]}} props.magick ImageMagick capability.
 * @param {object} props.settings App settings (rewrite provider + key for the keyword rebuild).
 * @param {boolean} props.active Whether this view is the visible one (gates keyboard nav).
 * @param {string} props.returnLabel Label for the Back button target (e.g. "Generate").
 * @param {Function} props.onBack Leave the single view.
 * @param {Function} props.onNavigate `(item)` — show another image (prev/next/parent/child).
 * @param {Function} props.onDelete `(item)`.
 * @param {Function} props.onSearch `(term)` — search the gallery for a keyword.
 * @param {Function} props.onMetaUpdate `(path, meta)` — apply a saved sidecar to the feed + view.
 * @param {Function} [props.onDerive] `(item, kind, source)` — re-roll / vary into a new image.
 * @param {Function} [props.onResize] `(item, scale)` — resize into a new image (ImageMagick).
 * @param {object[]} [props.derivations] In-flight derivations `{ id, parentPath, kind }`.
 * @param {string} [props.deriveError] The last re-roll / variation / resize failure, if any.
 * @returns {JSX.Element}
 */
export default function SingleView({
  items,
  current,
  magick,
  settings,
  active,
  returnLabel,
  onBack,
  onNavigate,
  onDelete,
  onSearch,
  onMetaUpdate,
  onDerive,
  onResize,
  onUpscale,
  derivations = [],
  deriveError,
}) {
  const intl = useIntl();
  const [rawView, setRawView] = useState(false);
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
            <p>{intl.formatMessage(msgs.noImage)}</p>
            <p className="g-empty-sub">{intl.formatMessage(msgs.noImageSub)}</p>
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
  const prov = getProvider(m.provider);
  const caps = prov?.capabilities || {};
  const showCap = (key) => caps[key] !== false;

  // --- Inline re-roll / make-variation actions, injected into the prompt layer rows ---
  const deriveLocked = !canDerive(m);
  const lockHint = intl.formatMessage(msgs.deriveLocked, {
    provider: m.providerLabel || prov?.label || m.provider || "This provider",
  });
  const runDerive = (kind, source) => {
    const confirmMsg =
      kind === "reroll"
        ? intl.formatMessage(msgs.confirmReroll)
        : intl.formatMessage(msgs.confirmVary, { layer: intl.formatMessage(layerMsg[source]) });
    if (confirm(confirmMsg)) onDerive(item, kind, source);
  };
  const varExtra = (source) => ({
    key: `vary-${source}`,
    label: intl.formatMessage(msgs.vary),
    title: deriveLocked
      ? lockHint
      : hasSource(m, source)
        ? intl.formatMessage(msgs.varyTitle)
        : intl.formatMessage(msgs.layerMissing, { layer: intl.formatMessage(layerMsg[source]) }),
    disabled: deriveLocked || !hasSource(m, source),
    onClick: () => runDerive("variation", source),
  });
  // Prompt-only inline actions: re-roll on the DPL recipe; make-variation on DPL / Sent / Translated.
  const extrasFor = (key) => {
    if (!onDisk || !onDerive || !item.meta) return [];
    if (key === "dpl") {
      return [
        {
          key: "reroll-dpl",
          label: intl.formatMessage(msgs.reroll),
          title: deriveLocked
            ? lockHint
            : hasSource(m, "dpl")
              ? intl.formatMessage(msgs.rerollTitle)
              : intl.formatMessage(msgs.layerMissing, { layer: intl.formatMessage(msgs.layerDpl) }),
          disabled: deriveLocked || !hasSource(m, "dpl"),
          onClick: () => runDerive("reroll", "dpl"),
        },
        varExtra("dpl"),
      ];
    }
    if (key === "final") return [varExtra("final")];
    if (key === "ai") return [varExtra("ai")];
    return [];
  };

  const size =
    pick(s, "width") && pick(s, "height") ? `${pick(s, "width")}×${pick(s, "height")}` : undefined;
  const saved = m.savedAt ? new Date(m.savedAt).toLocaleString() : undefined;
  const details = [
    [intl.formatMessage(msgs.dProvider), m.providerLabel || m.provider],
    [intl.formatMessage(msgs.dModel), pick(s, "model", "modelName", "checkpoint", "sd_model", "sd_model_hash")],
    ...(showCap("samplers")
      ? [[intl.formatMessage(msgs.dSampler), pick(s, "sampler", "samplerName", "sampler_name", "scheduler")]]
      : []),
    ...(showCap("steps") ? [[intl.formatMessage(msgs.dSteps), pick(s, "steps", "numSteps")]] : []),
    ...(showCap("cfg")
      ? [[intl.formatMessage(msgs.dCfg), pick(s, "cfg", "cfgScale", "cfg_scale", "guidance", "guidanceScale")]]
      : []),
    [intl.formatMessage(msgs.dSize), size],
    ...(showCap("seed") ? [[intl.formatMessage(msgs.dSeed), pick(s, "seed")]] : []),
    [intl.formatMessage(msgs.dSaved), saved],
    [intl.formatMessage(msgs.dFile), item.file],
  ];
  const shownKeys = new Set([
    "width", "height", "model", "modelName", "checkpoint", "sd_model", "sd_model_hash",
    "sampler", "samplerName", "sampler_name", "scheduler", "steps", "numSteps", "cfg",
    "cfgScale", "cfg_scale", "guidance", "guidanceScale", "seed", "negativePrompt", "prompt", "mode",
  ]);
  const restSettings = Object.entries(s).filter(
    ([k, v]) =>
      !shownKeys.has(k) && !REST_DROP.has(k) && v !== null && v !== "" && typeof v !== "object",
  );

  const markdown = toMarkdown(p.final || p.roll, n.final, details);
  const rawJson = item.meta ? JSON.stringify(item.meta, null, 2) : "";

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

  // --- Resize control (ImageMagick down/up-scale + provider AI Upscale) ---
  const magickOk = magick.available;
  // Providers that ship an AI upscale adapter; a key-gated one is offered but disabled until keyed.
  const upscalers = providers
    .filter((pp) => pp.capabilities?.upscale && pp.loadUpscale)
    .map((pp) => ({ id: pp.id, label: pp.label, ready: !pp.needsKey || !!effectiveKey(pp.id, settings) }));
  const hasUpscalers = upscalers.length > 0;
  const onResizePick = (e) => {
    const val = e.target.value;
    e.target.selectedIndex = 0;
    if (!val) return;
    const [kind, raw] = val.split(":");
    if (kind === "mag" && onResize) onResize(item, Number(raw));
    else if (kind === "ai" && onUpscale) onUpscale(item, raw);
  };

  return (
    <div className="gallery-view">
      <div className="g-inner">
        <div className="g-single">
          <div className="g-single-bar">
            <button className="g-back" onClick={onBack} title={intl.formatMessage(msgs.backTitle)}>
              {intl.formatMessage(msgs.back, {
                target: returnLabel || intl.formatMessage(msgs.galleryFallback),
              })}
            </button>
            <div className="g-single-nav">
              <button onClick={() => onNavigate(items[index - 1])} disabled={!hasPrev} title={intl.formatMessage(msgs.prevTitle)}>
                {intl.formatMessage(msgs.prev)}
              </button>
              {index >= 0 && (
                <span className="g-single-pos">
                  {index + 1} / {total}
                </span>
              )}
              <button onClick={() => onNavigate(items[index + 1])} disabled={!hasNext} title={intl.formatMessage(msgs.nextTitle)}>
                {intl.formatMessage(msgs.next)}
              </button>
            </div>
          </div>

          <div className="g-single-body">
            <div className="g-single-left">
              <div className="g-single-img">
                <a href={item.path} target="_blank" rel="noreferrer" title={intl.formatMessage(msgs.openFull)}>
                  <img src={item.path} alt={promptText(item) || item.file} />
                </a>
              </div>
              {/* Re-Rolls / Variations / Resizes strips, with live placeholders while generating. */}
              <DerivedStrips item={item} items={items} derivations={derivations} onNavigate={onNavigate} />
            </div>

            <div className="g-single-meta">
              {onDisk && (
                <div className="g-actions">
                  <button onClick={() => openImageFile(item.path)} title={intl.formatMessage(msgs.openDefault)}>
                    {intl.formatMessage(msgs.open)}
                  </button>
                  <button onClick={() => revealImageFile(item.path)} title={intl.formatMessage(msgs.revealTitle)}>
                    {intl.formatMessage(msgs.reveal)}
                  </button>
                  <a className="g-action-link" href={item.path} download={item.file}>
                    {intl.formatMessage(msgs.downloadPng)}
                  </a>

                  {/* Convert — always shown; greyed + locked with a tooltip when ImageMagick is absent. */}
                  <span className={`g-tool${magickOk ? "" : " is-locked"}`}>
                    <select
                      className="g-convert"
                      defaultValue=""
                      onChange={onConvert}
                      title={magickOk ? intl.formatMessage(msgs.convertTitle) : intl.formatMessage(msgs.convertLocked)}
                    >
                      <option value="">{intl.formatMessage(msgs.convertOption)}</option>
                      {magickOk
                        ? magick.formats.map((f) => (
                            <option key={f} value={f}>
                              {f.toUpperCase()}
                            </option>
                          ))
                        : (
                          <option value="" disabled>
                            {intl.formatMessage(msgs.needsMagickOpt)}
                          </option>
                        )}
                    </select>
                    {!magickOk && <span className="g-tool-lock" aria-hidden="true">🔒</span>}
                  </span>

                  {/* Resize — ImageMagick down/up-scale + a (locked) AI Upscale, always visible. */}
                  {onResize && (
                    <span className={`g-tool${magickOk || hasUpscalers ? "" : " is-locked"}`}>
                      <select
                        className="g-resize"
                        defaultValue=""
                        onChange={onResizePick}
                        title={magickOk ? intl.formatMessage(msgs.resizeTitle) : intl.formatMessage(msgs.resizeLocked)}
                      >
                        <option value="">{intl.formatMessage(msgs.resizeOption)}</option>
                        <optgroup label={intl.formatMessage(msgs.resizeGroupMagick)}>
                          {RESIZE_SCALES.map((sc) => {
                            const lbl = FRAC[sc] || `${sc}×`;
                            const base = sc < 1
                              ? intl.formatMessage(msgs.resizeDown, { label: lbl })
                              : intl.formatMessage(msgs.resizeUp, { label: lbl });
                            return (
                              <option key={sc} value={`mag:${sc}`} disabled={!magickOk}>
                                {magickOk ? base : intl.formatMessage(msgs.resizeNeedsMagick, { label: lbl })}
                              </option>
                            );
                          })}
                        </optgroup>
                        <optgroup label={intl.formatMessage(msgs.resizeGroupAi)}>
                          {hasUpscalers ? (
                            upscalers.map((u) => (
                              <option key={u.id} value={`ai:${u.id}`} disabled={!u.ready}>
                                {u.ready
                                  ? intl.formatMessage(msgs.aiUpscale, { provider: u.label })
                                  : intl.formatMessage(msgs.aiNeedsKey, { provider: u.label })}
                              </option>
                            ))
                          ) : (
                            <option value="ai:none" disabled>
                              {intl.formatMessage(msgs.aiUpscaleNone)}
                            </option>
                          )}
                        </optgroup>
                      </select>
                      {!magickOk && !hasUpscalers && <span className="g-tool-lock" aria-hidden="true">🔒</span>}
                    </span>
                  )}

                  <button className="g-danger" onClick={() => onDelete(item)} title={intl.formatMessage(msgs.deleteTitle)}>
                    {intl.formatMessage(msgs.delete)}
                  </button>
                </div>
              )}

              {!item.meta && (
                <p className="g-note">
                  <FormattedMessage
                    id="single.noMeta"
                    defaultMessage="No metadata sidecar was found for this image — it may pre-date sidecars or its <code>.json</code> file was removed."
                    values={{ code: (chunks) => <code>{chunks}</code> }}
                  />
                </p>
              )}

              <LineageHead item={item} items={items} onNavigate={onNavigate} />
              {deriveError && <p className="g-card-err">{intl.formatMessage(msgs.deriveError, { error: deriveError })}</p>}

              <PromptCard title={intl.formatMessage(msgs.promptTitle)} layers={p} extrasFor={extrasFor} />
              <PromptCard title={intl.formatMessage(msgs.negativeTitle)} layers={n} />

              {(item.meta || details.some(([, v]) => v !== undefined && v !== null && v !== "")) && (
                <section className="g-card">
                  <div className="g-card-head">
                    <h3 className="g-card-title">{intl.formatMessage(msgs.details)}</h3>
                    <div className="g-card-actions">
                      {item.meta && (
                        <button
                          className={`g-card-action${rawView ? " on" : ""}`}
                          onClick={() => setRawView((v) => !v)}
                        >
                          {intl.formatMessage(rawView ? msgs.viewTable : msgs.viewRaw)}
                        </button>
                      )}
                      <CopyButton
                        label={intl.formatMessage(msgs.copyMd)}
                        title={intl.formatMessage(msgs.copyMdTitle)}
                        text={markdown}
                      />
                      {item.meta && (
                        <CopyButton
                          label={intl.formatMessage(msgs.copyJson)}
                          title={intl.formatMessage(msgs.copyJsonTitle)}
                          text={rawJson}
                        />
                      )}
                    </div>
                  </div>
                  {rawView && item.meta ? (
                    <pre
                      className="g-json"
                      dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(rawJson) }}
                    />
                  ) : (
                    <>
                      <DetailTable rows={details} />
                      {restSettings.length > 0 && (
                        <details className="g-more">
                          <summary>
                            {intl.formatMessage(msgs.allSettings, { count: restSettings.length })}
                          </summary>
                          <DetailTable rows={restSettings.map(([k, v]) => [k, String(v)])} />
                        </details>
                      )}
                    </>
                  )}
                </section>
              )}

              <KeywordsCard
                text={p.final || p.roll}
                saved={Array.isArray(m.keywords) ? m.keywords : null}
                item={item}
                settings={settings}
                onSearch={onSearch}
                onSaved={(meta) => onMetaUpdate?.(item.path, meta)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
