/**
 * A small "preview" eye button: while hovered, it shows a floating tooltip that re-rolls a DPL
 * string into a concrete example every ~1s (the same live preview the building-block chips use).
 * Reads the DPL fresh on each tick via a ref, so edits while hovering are reflected.
 * @module gui/components/LivePreview
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { previewPrompt } from "../lib/promptEngine.js";

const msgs = defineMessages({
  preview: { id: "livePreview.preview", defaultMessage: "Preview" },
  live: {
    id: "livePreview.live",
    defaultMessage: "{label} (live)",
    description: "Tooltip on the live-preview eye button",
  },
});

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
export default function LivePreview({ getDpl, settings, label, triggerClassName = "field-act" }) {
  const intl = useIntl();
  const lbl = label ?? intl.formatMessage(msgs.preview);
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
          previewPrompt(dpl, { ...settingsRef.current, autoAddFx: false, autoAddArtists: false }),
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
        title={intl.formatMessage(msgs.live, { label: lbl })}
        aria-label={intl.formatMessage(msgs.live, { label: lbl })}
        tabIndex={-1}
      >
        <EyeIcon />
      </button>
      {hover && ex && (
        <div className="live-preview-pop" role="tooltip">
          <span className="live-preview-label">{lbl}</span>
          <span className="live-preview-text">{ex}</span>
        </div>
      )}
    </span>
  );
}
