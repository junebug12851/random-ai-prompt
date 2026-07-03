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
import { useEffect, useState } from "react";
import { useIntl, FormattedMessage } from "react-intl";
import { promptText, promptLayers, negativeLayers } from "../lib/gallery.js";
import { convertUrl } from "../lib/magick.js";
import { isOutputFile, openImageFile, revealImageFile } from "../lib/output.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { getProvider, providers } from "../lib/providers/index.js";
import { canDerive, hasSource, RESIZE_SCALES } from "../lib/derive.js";
import { msgs, layerMsg } from "./single/messages.js";
import { toMarkdown } from "../lib/single/markdown.js";
import { syntaxHighlightJson } from "../lib/single/json.js";
import { dialog } from "../lib/dialog.js";
import { MoreIcon } from "./icons.jsx";
import PromptCard from "./single/PromptCard.jsx";
import DetailTable from "./single/DetailTable.jsx";
import CopyButton from "./single/CopyButton.jsx";
import LineageHead from "./single/LineageHead.jsx";
import DerivedStrips from "./single/DerivedStrips.jsx";
import KeywordsCard from "./single/KeywordsCard.jsx";

// Fraction glyphs for sub-1 resize factors.
const FRAC = { 0.25: "¼×", 0.5: "½×" };

// First present value among several possible setting keys (providers name things differently).
const pick = (s, ...keys) => {
  for (const k of keys) if (s && s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
  return undefined;
};

// App-orchestration / sidecar-bookkeeping keys that should never appear in the "All settings"
// dump - so old sidecars (written before the snapshot was provider-scoped) stop leaking another
// provider's metadata into the table.
const REST_DROP = new Set([
  "provider", "providerLabel", "providerParams", "prompt", "negativePrompt", "promptCount",
  "locale", "includeAdult", "autoFix", "autoKeyword", "autoAddFx", "autoAddArtists",
  "rewriteProvider", "wrapper", "wrapperName", "wrapperParams", "useAutoSections", "keys", "mode",
  "parent", "derivedKind", "derivedSource", "savedAt", "file", "image",
]);

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
  const [copyOpen, setCopyOpen] = useState(false);
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
  const runDerive = async (kind, source) => {
    const confirmMsg =
      kind === "reroll"
        ? intl.formatMessage(msgs.confirmReroll)
        : intl.formatMessage(msgs.confirmVary, { layer: intl.formatMessage(layerMsg[source]) });
    if (await dialog.confirm({ message: confirmMsg })) onDerive(item, kind, source);
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
      // Re-roll only on the DPL source — "make variation" is offered on the Sent / AI layers instead.
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
                {/* Overlay actions, top-right — mirrors the gallery thumbnails. Download is the
                    extra (thumbnails don't have it); open / reveal / delete need the local file. */}
                <div className="img-actions g-img-actions">
                  {onDisk && (
                    <button
                      type="button"
                      title={intl.formatMessage(msgs.openDefault)}
                      aria-label={intl.formatMessage(msgs.open)}
                      onClick={() => openImageFile(item.path)}
                    >
                      ↗
                    </button>
                  )}
                  {onDisk && (
                    <button
                      type="button"
                      title={intl.formatMessage(msgs.revealTitle)}
                      aria-label={intl.formatMessage(msgs.reveal)}
                      onClick={() => revealImageFile(item.path)}
                    >
                      ⌖
                    </button>
                  )}
                  <a
                    className="ia-dl"
                    href={item.path}
                    download={item.file}
                    title={intl.formatMessage(msgs.downloadPng)}
                    aria-label={intl.formatMessage(msgs.downloadPng)}
                  >
                    ⤓
                  </a>
                  {onDisk && (
                    <button
                      type="button"
                      className="ia-del"
                      title={intl.formatMessage(msgs.deleteTitle)}
                      aria-label={intl.formatMessage(msgs.delete)}
                      onClick={() => onDelete(item)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              {/* Re-Rolls / Variations / Resizes strips, with live placeholders while generating. */}
              <DerivedStrips item={item} items={items} derivations={derivations} onNavigate={onNavigate} />
            </div>

            <div className="g-single-meta">
              {onDisk && (
                <div className="g-actions">
                  {/* Open / reveal / download / delete now live as overlay buttons on the image
                      (top-right, like the thumbnails) — only Convert & Resize remain here. */}

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
                      {/* Copy actions tuck behind a 3-dots menu so the header can't overflow. */}
                      <div className="g-copy-menu">
                        <button
                          className={`g-card-action g-copy-menu-btn${copyOpen ? " on" : ""}`}
                          onClick={() => setCopyOpen((o) => !o)}
                          aria-haspopup="menu"
                          aria-expanded={copyOpen}
                          aria-label={intl.formatMessage(msgs.copyMenu)}
                          title={intl.formatMessage(msgs.copyMenu)}
                        >
                          <MoreIcon />
                        </button>
                        {copyOpen && (
                          <>
                            <div
                              className="g-copy-scrim"
                              onClick={() => setCopyOpen(false)}
                              aria-hidden="true"
                            />
                            <div
                              className="g-copy-pop"
                              role="menu"
                              aria-label={intl.formatMessage(msgs.copyMenu)}
                            >
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
                          </>
                        )}
                      </div>
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
