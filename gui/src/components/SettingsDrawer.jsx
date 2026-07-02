/**
 * A right-side slide-over that houses the full Settings form, keeping the home page
 * uncluttered while the deep generation knobs stay one click away. Closes on the
 * overlay, the × button, or the Escape key.
 * @module gui/components/SettingsDrawer
 */
import { useEffect } from "react";
import { useIntl, defineMessages } from "react-intl";
import Settings from "./Settings.jsx";

const msgs = defineMessages({
  settings: { id: "settingsDrawer.title", defaultMessage: "Settings" },
  close: { id: "settingsDrawer.close", defaultMessage: "Close settings" },
});

/**
 * @param {object} props
 * @param {boolean} props.open Whether the drawer is shown.
 * @param {Function} props.onClose Close the drawer.
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {(JSX.Element|null)}
 */
export default function SettingsDrawer({ open, onClose, settings, setSettings }) {
  const intl = useIntl();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={intl.formatMessage(msgs.settings)}>
        <div className="drawer-head">
          <h2>{intl.formatMessage(msgs.settings)}</h2>
          <div className="spacer" />
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label={intl.formatMessage(msgs.close)}
          >
            ×
          </button>
        </div>
        <div className="drawer-body">
          <Settings settings={settings} setSettings={setSettings} />
        </div>
      </aside>
    </>
  );
}
