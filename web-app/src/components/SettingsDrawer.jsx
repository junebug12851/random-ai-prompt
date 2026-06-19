/**
 * A right-side slide-over that houses the full Settings form, keeping the home page
 * uncluttered while the deep generation knobs stay one click away. Closes on the
 * overlay, the × button, or the Escape key.
 * @module web-app/components/SettingsDrawer
 */
import { useEffect } from "react";
import Settings from "./Settings.jsx";

/**
 * @param {object} props
 * @param {boolean} props.open Whether the drawer is shown.
 * @param {Function} props.onClose Close the drawer.
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {(JSX.Element|null)}
 */
export default function SettingsDrawer({ open, onClose, settings, setSettings }) {
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
      <aside className="drawer" role="dialog" aria-label="Settings">
        <div className="drawer-head">
          <h2>Settings</h2>
          <div className="spacer" />
          <button className="drawer-close" onClick={onClose} aria-label="Close settings">
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
