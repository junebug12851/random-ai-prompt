/**
 * One generated prompt and its image batches. Each "Generate images" press adds a batch beneath
 * the prompt. Per image: open in the OS default app, reveal in Explorer, or remove (with an option
 * to delete from disk). A batch and the whole prompt can be cleared too. Clicking an image opens it
 * in the single view.
 *
 * The prompt text and its source DPL / original are all **click-to-copy** (no separate copy button).
 * Hovering shows the full text; hovering the **DPL** also shows a live example that re-rolls every
 * second (so you can see the range of what that DPL produces).
 * @module gui/components/PromptResult
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { isOutputFile, openImageFile, revealImageFile, openImageInNewTab } from "../lib/output.js";
import { previewPrompt } from "../lib/promptEngine.js";
import { TrashIcon } from "./icons.jsx";

const msgs = defineMessages({
  resultAlt: { id: "promptResult.resultAlt", defaultMessage: "result" },
  dplTitle: {
    id: "promptResult.dplTitle",
    defaultMessage: "The DPL this was rolled from — click to copy",
  },
  example: { id: "promptResult.example", defaultMessage: "Example:" },
  originalTitle: {
    id: "promptResult.originalTitle",
    defaultMessage: "Original prompt (before auto-fix) — click to copy\n\n{original}",
  },
  copyTitle: { id: "promptResult.copyTitle", defaultMessage: "Click to copy\n\n{text}" },
  genTitle: {
    id: "promptResult.genTitle",
    defaultMessage: "Generate a batch of images for this prompt",
  },
  moreImages: { id: "promptResult.moreImages", defaultMessage: "More images" },
  genImages: { id: "promptResult.genImages", defaultMessage: "Generate images" },
  clearTitle: {
    id: "promptResult.clearTitle",
    defaultMessage: "Clear this prompt's images (asks about deleting from disk)",
  },
  clear: { id: "promptResult.clear", defaultMessage: "clear" },
  batch: { id: "promptResult.batch", defaultMessage: "Batch {n}" },
  rendering: { id: "promptResult.rendering", defaultMessage: "rendering…" },
  removeBatch: { id: "promptResult.removeBatch", defaultMessage: "remove batch" },
  renderingAria: { id: "promptResult.renderingAria", defaultMessage: "rendering" },
  openSingle: { id: "promptResult.openSingle", defaultMessage: "Open in the single view" },
  openNewTab: { id: "promptResult.openNewTab", defaultMessage: "Open in a new tab" },
  openDefault: { id: "promptResult.openDefault", defaultMessage: "Open in default app" },
  reveal: { id: "promptResult.reveal", defaultMessage: "Reveal in file explorer" },
  removeImage: { id: "promptResult.removeImage", defaultMessage: "Remove image" },
});

/**
 * A result image that fades in once it has actually loaded.
 * @param {object} props `{ src }`.
 * @returns {JSX.Element}
 */
function ResultImage({ src }) {
  const intl = useIntl();
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={intl.formatMessage(msgs.resultAlt)}
      className={`result-img${loaded ? " loaded" : ""}`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
    />
  );
}

/**
 * The source-DPL line: click-to-copy, with a hover tooltip showing the full DPL and a concrete
 * example that re-rolls every second (the same live preview the building-block chips use).
 * @param {object} props `{ dpl, settings }`.
 * @returns {JSX.Element}
 */
function DplHoverCode({ dpl, settings }) {
  const intl = useIntl();
  const [hover, setHover] = useState(false);
  const [ex, setEx] = useState("");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!hover) {
      setEx("");
      return undefined;
    }
    const roll = () => {
      try {
        setEx(previewPrompt(dpl, { ...settingsRef.current, autoAddFx: false, autoAddArtists: false }));
      } catch {
        setEx("");
      }
    };
    roll();
    const id = setInterval(roll, 1000);
    return () => clearInterval(id);
  }, [hover, dpl]);

  return (
    <span
      className="dpl-hover"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <code
        className="prompt-dpl"
        title={intl.formatMessage(msgs.dplTitle)}
        onClick={() => navigator.clipboard?.writeText(dpl).catch(() => {})}
      >
        {dpl}
      </code>
      {hover && (
        <div className="dpl-hover-tip" role="tooltip">
          <div className="dpl-hover-full">{dpl}</div>
          {ex && (
            <div className="dpl-hover-ex">
              <span className="dpl-hover-ex-label">{intl.formatMessage(msgs.example)}</span> {ex}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

const ImageIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

/**
 * @param {object} props
 * @param {object} props.prompt `{ id, text, batches: [{ id, busy, images }] }`.
 * @param {number} props.index Zero-based index in the list.
 * @param {object} props.settings The generation settings (for the DPL example tooltip).
 * @param {boolean} props.canGenerate Whether the active provider can render images.
 * @param {Function} props.onGenerate `(promptId)`.
 * @param {Function} props.onCopy `(text)`.
 * @param {Function} props.onRemoveImage `(promptId, batchId, img)`.
 * @param {Function} props.onRemoveBatch `(promptId, batchId)`.
 * @param {Function} props.onClearImages `(promptId)`.
 * @param {Function} [props.onImageClick] `(img)` — open the image in the single view.
 * @returns {JSX.Element}
 */
export default function PromptResult({
  prompt,
  index,
  number,
  settings,
  canGenerate,
  onGenerate,
  onCopy,
  onRemoveImage,
  onRemoveBatch,
  onClearImages,
  onImageClick,
}) {
  const intl = useIntl();
  const hasImages = prompt.batches.some((b) => b.images.length);
  return (
    <li className="prompt-result">
      <div className="prompt-line">
        <span className="idx">{String(number ?? index + 1).padStart(2, "0")}</span>
        <div className="prompt-main">
          {prompt.dpl && <DplHoverCode dpl={prompt.dpl} settings={settings} />}
          {prompt.original && (
            <code
              className="prompt-dpl prompt-original"
              title={intl.formatMessage(msgs.originalTitle, { original: prompt.original })}
              onClick={() => navigator.clipboard?.writeText(prompt.original).catch(() => {})}
            >
              {prompt.original}
            </code>
          )}
          <span
            className="prompt-text"
            title={intl.formatMessage(msgs.copyTitle, { text: prompt.text })}
            onClick={() => onCopy(prompt.text)}
          >
            {prompt.text}
          </span>
        </div>
        <div className="prompt-actions">
          {canGenerate && (
            <button
              className="gen-btn"
              onClick={() => onGenerate(prompt.id)}
              title={intl.formatMessage(msgs.genTitle)}
            >
              <ImageIcon />
              <span className="gen-btn-label">
                {intl.formatMessage(prompt.batches.length ? msgs.moreImages : msgs.genImages)}
              </span>
            </button>
          )}
          {hasImages && (
            <button
              className="copy-mini clear-icon-btn"
              title={intl.formatMessage(msgs.clearTitle)}
              aria-label={intl.formatMessage(msgs.clearTitle)}
              onClick={() => onClearImages(prompt.id)}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {prompt.batches.map((b, bi) => (
        <div className="batch" key={b.id}>
          <div className="batch-head">
            <span className="batch-label">
              {intl.formatMessage(msgs.batch, { n: prompt.batches.length - bi })}
            </span>
            {b.busy ? (
              <span className="batch-status">{intl.formatMessage(msgs.rendering)}</span>
            ) : (
              b.images.length > 0 && (
                <button className="link-btn" onClick={() => onRemoveBatch(prompt.id, b.id)}>
                  {intl.formatMessage(msgs.removeBatch)}
                </button>
              )
            )}
          </div>
          {b.busy ? (
            <div className="gallery">
              {Array.from({ length: b.count || 1 }).map((_, i) => (
                <figure key={i} className="skeleton-fig">
                  <div className="img-skeleton" aria-label={intl.formatMessage(msgs.renderingAria)} />
                </figure>
              ))}
            </div>
          ) : (
            <div className="gallery">
              {b.images.map((img) => (
                <figure key={img}>
                  <a
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    title={intl.formatMessage(onImageClick ? msgs.openSingle : msgs.openNewTab)}
                    onClick={(e) => {
                      e.preventDefault();
                      if (onImageClick) onImageClick(img);
                      else openImageInNewTab(img);
                    }}
                  >
                    <ResultImage src={img} />
                  </a>
                  <div className="img-actions">
                    {isOutputFile(img) && (
                      <>
                        <button title={intl.formatMessage(msgs.openDefault)} onClick={() => openImageFile(img)}>
                          ↗
                        </button>
                        <button
                          title={intl.formatMessage(msgs.reveal)}
                          onClick={() => revealImageFile(img)}
                        >
                          ⌖
                        </button>
                      </>
                    )}
                    <button
                      title={intl.formatMessage(msgs.removeImage)}
                      onClick={() => onRemoveImage(prompt.id, b.id, img)}
                    >
                      ✕
                    </button>
                  </div>
                </figure>
              ))}
            </div>
          )}
        </div>
      ))}
    </li>
  );
}
