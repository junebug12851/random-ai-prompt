/**
 * A copy-to-clipboard button with brief ✓ feedback (Markdown / JSON export on the single view).
 * @module gui/components/single/CopyButton
 */
import { useState } from "react";
import { useIntl } from "react-intl";
import { msgs } from "./messages.js";

/** A copy-to-clipboard button with brief ✓ feedback. */
export default function CopyButton({ label, text, title }) {
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
