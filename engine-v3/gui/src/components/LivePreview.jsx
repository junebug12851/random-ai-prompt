/**
 * A small "preview" eye button: while hovered, it shows a floating tooltip that re-rolls a DPL
 * string into a concrete example every ~1s (the same live preview the building-block chips use).
 * Reads the DPL fresh on each tick via a ref, so edits while hovering are reflected.
 * @module gui/components/LivePreview
 */
import { useEffect, useRef, useState } from "react";
import { expandPrompt } from "../lib/promptEngine.js";

const EyeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * @param {object} props
 * @param {() => string} props.getDpl Returns the DPL text to preview (read each tick).
 * @param {object} props.settings The generation settings (for the engine).
 * @param {string} [props.label] Tooltip label.
 * @param {string} [props.triggerClassName] Class for the trigger button.
 * @returns {JSX.Element}
 */
export default function LivePreview({
  getDpl,
  settings,
  label = "Preview",
  triggerClassName = "field-act",
}) {
  const [hover, setHover] = useState(false);
  const [ex, setEx] = useState("");
  const getRef = useRef(getDpl);
  getRef.current = getDpl;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!hover) {
      setEx("");
      return undefined;
    }
    const roll = () => {
      try {
        const dpl = getRef.current() || "{#random-words}";
        setEx(
          expandPrompt(dpl, { ...settingsRef.current, autoAddFx: false, autoAddArtists: false }),
        );
      } catch {
        setEx("");
      }
    };
    roll();
    const id = setInterval(roll, 1000);
    return () => clearInterval(id);
  }, [hover]);

  return (
    <span
      className="live-preview"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={triggerClassName}
        title={`${label} (live)`}
        aria-label={`${label} (live)`}
        tabIndex={-1}
      >
        <EyeIcon />
      </button>
      {hover && ex && (
        <div className="live-preview-pop" role="tooltip">
          <span className="live-preview-label">{label}</span>
          <span className="live-preview-text">{ex}</span>
        </div>
      )}
    </span>
  );
}
