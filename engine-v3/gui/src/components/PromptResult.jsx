/**
 * One generated prompt and its image batches. Each "Generate images" press adds a batch beneath
 * the prompt. Per image: open in the OS default app, reveal in Explorer, or remove (with an option
 * to delete from disk). A batch and the whole prompt can be cleared too. Clicking an image opens it
 * in a new tab for now (galleries come later).
 * @module gui/components/PromptResult
 */
import { isOutputFile, openImageFile, revealImageFile } from "../lib/output.js";

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
 * @param {boolean} props.canGenerate Whether the active provider can render images.
 * @param {Function} props.onGenerate `(promptId)`.
 * @param {Function} props.onCopy `(text)`.
 * @param {Function} props.onRemoveImage `(promptId, batchId, img)`.
 * @param {Function} props.onRemoveBatch `(promptId, batchId)`.
 * @param {Function} props.onClearImages `(promptId)`.
 * @returns {JSX.Element}
 */
export default function PromptResult({
  prompt,
  index,
  canGenerate,
  onGenerate,
  onCopy,
  onRemoveImage,
  onRemoveBatch,
  onClearImages,
}) {
  const hasImages = prompt.batches.some((b) => b.images.length);
  return (
    <li className="prompt-result">
      <div className="prompt-line">
        <span className="idx">{String(index + 1).padStart(2, "0")}</span>
        <span className="prompt-text">{prompt.text}</span>
        <div className="prompt-actions">
          {canGenerate && (
            <button
              className="gen-btn"
              onClick={() => onGenerate(prompt.id)}
              title="Generate a batch of images for this prompt"
            >
              <ImageIcon />
              {prompt.batches.length ? "More images" : "Generate images"}
            </button>
          )}
          <button className="copy-mini" title="Copy prompt" onClick={() => onCopy(prompt.text)}>
            copy
          </button>
        </div>
      </div>

      {prompt.batches.map((b, bi) => (
        <div className="batch" key={b.id}>
          <div className="batch-head">
            <span className="batch-label">Batch {bi + 1}</span>
            {b.busy ? (
              <span className="batch-status">rendering…</span>
            ) : (
              b.images.length > 0 && (
                <button className="link-btn" onClick={() => onRemoveBatch(prompt.id, b.id)}>
                  remove batch
                </button>
              )
            )}
          </div>
          {b.busy ? (
            <div className="batch-loading">Rendering {b.images.length || ""} image(s)…</div>
          ) : (
            <div className="gallery">
              {b.images.map((img) => (
                <figure key={img}>
                  <a href={img} target="_blank" rel="noreferrer" title="Open in a new tab">
                    <img src={img} alt="result" />
                  </a>
                  <div className="img-actions">
                    {isOutputFile(img) && (
                      <>
                        <button title="Open in default app" onClick={() => openImageFile(img)}>
                          ↗
                        </button>
                        <button
                          title="Reveal in file explorer"
                          onClick={() => revealImageFile(img)}
                        >
                          ⌖
                        </button>
                      </>
                    )}
                    <button
                      title="Remove image"
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

      {hasImages && (
        <button className="link-btn clear-imgs" onClick={() => onClearImages(prompt.id)}>
          clear all images for this prompt
        </button>
      )}
    </li>
  );
}
