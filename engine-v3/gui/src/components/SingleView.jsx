/**
 * The single-image view — a dedicated full page for one saved image and its sidecar, promoted to a
 * top-level view (its own header tab) alongside Generate and Gallery. Sticky image on the left;
 * on the right the prompt and negative each in their DPL / engine-roll / AI-translation / sent
 * layers, a curated details table over the full settings snapshot + raw JSON, a clickable keyword
 * cloud, prev/next navigation across the feed, and actions (open / reveal / download PNG /
 * convert-&-download via ImageMagick / delete).
 *
 * It also carries forward two v1-2 features: **re-roll / variation** (regenerate a fresh image from
 * a captured prompt layer — the DPL recipe, the AI translation, or the original roll — with a new
 * seed) and **ancestry** (each derived image keeps its parent's id; the feed scan rebuilds the
 * reverse child list, and the view links parent ↔ children for navigation).
 *
 * State lives in `App` (the current image, the feed) so the view keeps its place when you switch
 * tabs. It stays mounted but hidden when inactive, so keyboard nav is gated on `active`.
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
import { getProvider } from "../lib/providers/index.js";
import { canDerive, hasSource } from "../lib/derive.js";

const msgs = defineMessages({
  copy: { id: "single.copy", defaultMessage: "copy" },
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
  deleteTitle: { id: "single.deleteTitle", defaultMessage: "Delete from disk" },
  delete: { id: "single.delete", defaultMessage: "Delete" },
  details: { id: "single.details", defaultMessage: "Details" },
  copyMd: { id: "single.copyMd", defaultMessage: "Copy as Markdown" },
  copiedMd: { id: "single.copiedMd", defaultMessage: "✓ Copied" },
  copyMdTitle: {
    id: "single.copyMdTitle",
    defaultMessage: "Copy the prompt, negative, and details as a Markdown block",
  },
  allSettings: { id: "single.allSettings", defaultMessage: "All settings ({count})" },
  rawMeta: { id: "single.rawMeta", defaultMessage: "Raw metadata (JSON)" },
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
  makeAnother: { id: "single.makeAnother", defaultMessage: "Make another" },
  reroll: { id: "single.reroll", defaultMessage: "Re-roll" },
  rerollTitle: {
    id: "single.rerollTitle",
    defaultMessage: "Re-roll the recipe — a fresh random prompt from the DPL, with a new seed",
  },
  variation: { id: "single.variation", defaultMessage: "Variation" },
  varDpl: { id: "single.varDpl", defaultMessage: "DPL" },
  varAi: { id: "single.varAi", defaultMessage: "Translated" },
  varRoll: { id: "single.varRoll", defaultMessage: "Original" },
  varDplTitle: {
    id: "single.varDplTitle",
    defaultMessage: "Vary from the DPL recipe — re-rolls the random parts, new seed",
  },
  varAiTitle: {
    id: "single.varAiTitle",
    defaultMessage: "Vary from the AI translation — same words, new seed",
  },
  varRollTitle: {
    id: "single.varRollTitle",
    defaultMessage: "Vary from the original engine roll — same words, new seed",
  },
  deriveLocked: {
    id: "single.deriveLocked",
    defaultMessage: "{provider} doesn't support seeds — re-roll & variations need seed control",
  },
  layerMissing: {
    id: "single.layerMissing",
    defaultMessage: "This image has no {layer} layer to vary from",
  },
  deriveError: { id: "single.deriveError", defaultMessage: "Couldn't make another: {error}" },
  // Pending placeholder
  pendingReroll: { id: "single.pendingReroll", defaultMessage: "Rolling a new image…" },
  pendingVariation: { id: "single.pendingVariation", defaultMessage: "Generating a variation…" },
  pendingSub: {
    id: "single.pendingSub",
    defaultMessage: "The new image will appear here as soon as the provider returns it.",
  },
  // Ancestry / lineage
  lineage: { id: "single.lineage", defaultMessage: "Lineage" },
  typeBase: { id: "single.typeBase", defaultMessage: "Base image" },
  typeReroll: { id: "single.typeReroll", defaultMessage: "Re-roll" },
  typeVariation: { id: "single.typeVariation", defaultMessage: "Variation" },
  fromLayer: { id: "single.fromLayer", defaultMessage: "from {layer}" },
  parentLink: { id: "single.parentLink", defaultMessage: "↑ Parent" },
  parentTitle: { id: "single.parentTitle", defaultMessage: "Open the image this was made from" },
  derivedCount: {
    id: "single.derivedCount",
    defaultMessage: "{count, plural, one {# derived image} other {# derived images}}",
  },
  layerDpl: { id: "single.layerDpl", defaultMessage: "DPL" },
  layerAi: { id: "single.layerAi", defaultMessage: "translation" },
  layerRoll: { id: "single.layerRoll", defaultMessage: "original roll" },
});

// Human label for a derive source layer.
const layerMsg = { dpl: msgs.layerDpl, ai: msgs.layerAi, roll: msgs.layerRoll };

/** A labeled, copyable block of prompt/negative text (skipped when empty). */
function TextRow({ label, value, mono, accent }) {
  const intl = useIntl();
  if (!value) return null;
  const copy = () => navigator.clipboard?.writeText(String(value)).catch(() => {});
  return (
    <div className={`g-text-row${accent ? " accent" : ""}`}>
      <div className="g-text-head">
        <span className="g-text-label">{label}</span>
        <button className="g-copy" onClick={copy}>
          {intl.formatMessage(msgs.copy)}
        </button>
      </div>
      <p className={`g-text-val${mono ? " mono" : ""}`}>{value}</p>
    </div>
  );
}

/** The prompt (or negative) card: its layers, most-relevant first, dupes collapsed. */
function PromptCard({ title, layers }) {
  const intl = useIntl();
  if (!layers.final && !layers.ai && !layers.roll && !layers.dpl) return null;
  const showRoll = layers.roll && layers.roll !== layers.final;
  const showAi = layers.ai && layers.ai !== layers.final;
  return (
    <section className="g-card">
      <h3 className="g-card-title">{title}</h3>
      <TextRow label={intl.formatMessage(msgs.sentToModel)} value={layers.final} accent />
      {showAi && <TextRow label={intl.formatMessage(msgs.aiTranslation)} value={layers.ai} />}
      {showRoll && <TextRow label={intl.formatMessage(msgs.engineRoll)} value={layers.roll} />}
      <TextRow label={intl.formatMessage(msgs.dplSource)} value={layers.dpl} mono />
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

/** The "Copy as Markdown" button (brief ✓ feedback). */
function CopyMarkdownButton({ markdown }) {
  const intl = useIntl();
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(markdown)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      })
      .catch(() => {});
  };
  return (
    <button className="g-card-action" onClick={copy} title={intl.formatMessage(msgs.copyMdTitle)}>
      {intl.formatMessage(done ? msgs.copiedMd : msgs.copyMd)}
    </button>
  );
}

/**
 * The re-roll / variation cluster. Re-roll regenerates from the DPL recipe; Variation can draw
 * from the DPL recipe, the AI translation, or the original roll. Every action makes a NEW image
 * with a fresh seed, so the whole cluster is locked (with a tooltip) for providers without seeds.
 * @param {object} props
 * @param {object} props.item The source gallery item.
 * @param {Function} props.onDerive `(item, kind, source)`.
 * @returns {JSX.Element}
 */
function MakeAnother({ item, onDerive }) {
  const intl = useIntl();
  const m = item.meta || {};
  const prov = getProvider(m.provider);
  const seedLocked = !canDerive(m);
  const lockHint = intl.formatMessage(msgs.deriveLocked, {
    provider: m.providerLabel || prov?.label || m.provider || "This provider",
  });
  const missingHint = (src) =>
    intl.formatMessage(msgs.layerMissing, { layer: intl.formatMessage(layerMsg[src]) });

  const enabled = (src) => !seedLocked && hasSource(m, src);
  const title = (src, baseTitle) =>
    seedLocked ? lockHint : hasSource(m, src) ? baseTitle : missingHint(src);

  return (
    <section className="g-card g-derive">
      <h3 className="g-card-title">{intl.formatMessage(msgs.makeAnother)}</h3>
      <div className="g-derive-row">
        <button
          className="g-derive-btn primary"
          disabled={!enabled("dpl")}
          title={title("dpl", intl.formatMessage(msgs.rerollTitle))}
          onClick={() => onDerive(item, "reroll", "dpl")}
        >
          {intl.formatMessage(msgs.reroll)}
        </button>
      </div>
      <div className="g-derive-row">
        <span className="g-derive-label">{intl.formatMessage(msgs.variation)}</span>
        <button
          className="g-derive-btn"
          disabled={!enabled("dpl")}
          title={title("dpl", intl.formatMessage(msgs.varDplTitle))}
          onClick={() => onDerive(item, "variation", "dpl")}
        >
          {intl.formatMessage(msgs.varDpl)}
        </button>
        <button
          className="g-derive-btn"
          disabled={!enabled("ai")}
          title={title("ai", intl.formatMessage(msgs.varAiTitle))}
          onClick={() => onDerive(item, "variation", "ai")}
        >
          {intl.formatMessage(msgs.varAi)}
        </button>
        <button
          className="g-derive-btn"
          disabled={!enabled("roll")}
          title={title("roll", intl.formatMessage(msgs.varRollTitle))}
          onClick={() => onDerive(item, "variation", "roll")}
        >
          {intl.formatMessage(msgs.varRoll)}
        </button>
      </div>
    </section>
  );
}

/**
 * The lineage card: a type label (Base / Re-roll / Variation), a link up to the parent, and a
 * strip of derived-child thumbnails. Built from the feed-scanned ancestry on the item.
 * @param {object} props
 * @param {object} props.item The current item (with `meta.parent` + `children`).
 * @param {object[]} props.items The feed (to resolve parent/child items for navigation).
 * @param {Function} props.onNavigate `(item)`.
 * @returns {JSX.Element|null}
 */
function LineageCard({ item, items, onNavigate }) {
  const intl = useIntl();
  const m = item.meta || {};
  const children = item.children || [];
  const parentItem = m.parent ? items.find((it) => it.name === m.parent) : null;

  // Nothing to show for a plain base image with no derivatives.
  if (!m.parent && children.length === 0) return null;

  const kindLabel =
    m.derivedKind === "reroll"
      ? intl.formatMessage(msgs.typeReroll)
      : intl.formatMessage(msgs.typeVariation);
  const srcMsg = layerMsg[m.derivedSource];

  return (
    <section className="g-card g-lineage">
      <h3 className="g-card-title">{intl.formatMessage(msgs.lineage)}</h3>
      <div className="g-lineage-head">
        <span className="g-lineage-type">
          {m.parent ? kindLabel : intl.formatMessage(msgs.typeBase)}
          {m.parent && srcMsg && (
            <span className="g-lineage-from">
              {" "}
              {intl.formatMessage(msgs.fromLayer, { layer: intl.formatMessage(srcMsg) })}
            </span>
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
      {children.length > 0 && (
        <>
          <div className="g-lineage-count">
            {intl.formatMessage(msgs.derivedCount, { count: children.length })}
          </div>
          <div className="g-lineage-strip">
            {children.map((c) => {
              const childItem = items.find((it) => it.path === c.path);
              return (
                <button
                  key={c.path}
                  className="g-lineage-thumb"
                  onClick={() => childItem && onNavigate(childItem)}
                  title={c.kind === "reroll" ? intl.formatMessage(msgs.typeReroll) : intl.formatMessage(msgs.typeVariation)}
                >
                  <img src={c.path} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The clickable keyword cloud. Prefers a saved keyword list on the sidecar (`meta.keywords`, e.g.
 * one the AI rebuilt and we alphabetized); otherwise it parses clean tags from the sent prompt with
 * the shared keyword parser (which strips SD/NovelAI weighting syntax and de-accents for matching).
 * The "Rebuild with AI" button asks the configured rewrite provider to break the sent prompt into a
 * tidy tag list, sorts it alphabetically, and saves it over the sidecar's keyword set.
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

  // Saved list wins; otherwise parse clean tags from the prompt. Both produce display strings.
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
      // The model replies with a comma list; clean, de-dupe, and alphabetize it.
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

  // Nothing worth showing unless there are tags or the rebuild action is available.
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

/** The Back + prev/next bar (shared by the normal view and the loading placeholder). */
function TopBar({ intl, returnLabel, onBack, index, total, hasPrev, hasNext, onNavigate, items }) {
  return (
    <div className="g-single-bar">
      <button className="g-back" onClick={onBack} title={intl.formatMessage(msgs.backTitle)}>
        {intl.formatMessage(msgs.back, {
          target: returnLabel || intl.formatMessage(msgs.galleryFallback),
        })}
      </button>
      <div className="g-single-nav">
        <button
          onClick={() => onNavigate(items[index - 1])}
          disabled={!hasPrev}
          title={intl.formatMessage(msgs.prevTitle)}
        >
          {intl.formatMessage(msgs.prev)}
        </button>
        {index >= 0 && (
          <span className="g-single-pos">
            {index + 1} / {total}
          </span>
        )}
        <button
          onClick={() => onNavigate(items[index + 1])}
          disabled={!hasNext}
          title={intl.formatMessage(msgs.nextTitle)}
        >
          {intl.formatMessage(msgs.next)}
        </button>
      </div>
    </div>
  );
}

/**
 * The single-image view.
 * @param {object} props
 * @param {object[]} props.items The feed (drives prev/next + ancestry resolution).
 * @param {object|null} props.current The image being shown (or a `pending` placeholder mid-derive).
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
 * @param {string} [props.deriveError] The last re-roll / variation failure, if any.
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
  deriveError,
}) {
  const intl = useIntl();
  const pending = !!(current && current.pending);
  const index = current && !pending ? items.findIndex((it) => it.path === current.path) : -1;
  const total = items.length;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;

  useEffect(() => {
    if (!active || !current || pending) return undefined;
    const onKey = (e) => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(items[index - 1]);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(items[index + 1]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, current, pending, items, index, hasPrev, hasNext, onBack, onNavigate]);

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

  // --- Loading placeholder while a re-roll / variation generates (App holds a `pending` current) ---
  if (pending) {
    const pendingFinal = current.meta?.prompt?.final;
    const headline =
      current.derivedKind === "reroll"
        ? intl.formatMessage(msgs.pendingReroll)
        : intl.formatMessage(msgs.pendingVariation);
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
            </div>
            <div className="g-single-body">
              <div className="g-single-img">
                <div className="g-pending" role="status" aria-live="polite">
                  <div className="g-pending-spinner" aria-hidden="true" />
                  <p className="g-pending-head">{headline}</p>
                  <p className="g-pending-sub">{intl.formatMessage(msgs.pendingSub)}</p>
                </div>
              </div>
              <div className="g-single-meta">
                {pendingFinal && (
                  <section className="g-card">
                    <h3 className="g-card-title">{intl.formatMessage(msgs.promptTitle)}</h3>
                    <TextRow
                      label={intl.formatMessage(msgs.sentToModel)}
                      value={pendingFinal}
                      accent
                    />
                  </section>
                )}
              </div>
            </div>
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
  // A capability declared `false` (e.g. OpenAI has no sampler/steps/cfg/seed) hides that row, so an
  // image's details table only shows knobs its provider actually has — no leaked foreign metadata.
  const showCap = (key) => caps[key] !== false;

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

  // Markdown export: the sent prompt + negative + the (already capability-filtered) detail rows.
  const markdown = toMarkdown(p.final || p.roll, n.final, details);

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
          <TopBar
            intl={intl}
            returnLabel={returnLabel}
            onBack={onBack}
            index={index}
            total={total}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigate={onNavigate}
            items={items}
          />

          <div className="g-single-body">
            <div className="g-single-img">
              <a href={item.path} target="_blank" rel="noreferrer" title={intl.formatMessage(msgs.openFull)}>
                <img src={item.path} alt={promptText(item) || item.file} />
              </a>
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
                  {magick.available && magick.formats.length > 0 && (
                    <select
                      className="g-convert"
                      defaultValue=""
                      onChange={onConvert}
                      title={intl.formatMessage(msgs.convertTitle)}
                    >
                      <option value="">{intl.formatMessage(msgs.convertOption)}</option>
                      {magick.formats.map((f) => (
                        <option key={f} value={f}>
                          {f.toUpperCase()}
                        </option>
                      ))}
                    </select>
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

              {/* Re-roll / variation — only with a sidecar (we need its prompt layers + provider). */}
              {onDisk && onDerive && item.meta && <MakeAnother item={item} onDerive={onDerive} />}
              {deriveError && <p className="g-card-err">{intl.formatMessage(msgs.deriveError, { error: deriveError })}</p>}

              <LineageCard item={item} items={items} onNavigate={onNavigate} />

              <PromptCard title={intl.formatMessage(msgs.promptTitle)} layers={p} />
              <PromptCard title={intl.formatMessage(msgs.negativeTitle)} layers={n} />

              {details.some(([, v]) => v !== undefined && v !== null && v !== "") && (
                <section className="g-card">
                  <div className="g-card-head">
                    <h3 className="g-card-title">{intl.formatMessage(msgs.details)}</h3>
                    <CopyMarkdownButton markdown={markdown} />
                  </div>
                  <DetailTable rows={details} />
                  {restSettings.length > 0 && (
                    <details className="g-more">
                      <summary>
                        {intl.formatMessage(msgs.allSettings, { count: restSettings.length })}
                      </summary>
                      <DetailTable rows={restSettings.map(([k, v]) => [k, String(v)])} />
                    </details>
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

              {item.meta && (
                <details className="g-more">
                  <summary>{intl.formatMessage(msgs.rawMeta)}</summary>
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
