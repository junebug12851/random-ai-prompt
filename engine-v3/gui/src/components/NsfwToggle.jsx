/**
 * The header NSFW switch. The whole app defaults to SFW; this is the only control
 * that lets adult content through (it flips `settings.includeAdult`, which the engine
 * gates on). Turning it ON requires an explicit confirmation; turning it OFF is
 * immediate. The choice rides in `settings` and so is remembered in this browser.
 * @module gui/components/NsfwToggle
 */
import { useEffect, useState } from "react";

/**
 * @param {object} props
 * @param {object} props.settings The current settings (`includeAdult`).
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element} The right-aligned NSFW switch (+ its confirm dialog).
 */
export default function NsfwToggle({ settings, setSettings }) {
  const on = settings.includeAdult === true;
  const [confirming, setConfirming] = useState(false);

  // Escape cancels the confirm dialog.
  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (e) => e.key === "Escape" && setConfirming(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  // Disabling is immediate; enabling asks first.
  const toggle = () => {
    if (on) setSettings((s) => ({ ...s, includeAdult: false }));
    else setConfirming(true);
  };

  const enable = () => {
    setSettings((s) => ({ ...s, includeAdult: true }));
    setConfirming(false);
  };

  return (
    <div className="nsfw-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`switch${on ? " is-on" : ""}`}
        onClick={toggle}
        title={on ? "Adult content is on — click to switch back to SFW" : "Show adult (NSFW) content"}
      >
        <span className="switch-label">NSFW</span>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
      </button>

      {confirming && (
        <>
          <div className="modal-overlay" onClick={() => setConfirming(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="nsfw-confirm-title">
            <h2 id="nsfw-confirm-title">Show adult content?</h2>
            <p>
              Enabling NSFW unlocks explicit adult words, artists, and generators in prompts and previews. Only continue
              if you are 18 or older and want to see this material.
            </p>
            <p className="modal-note">Your choice is remembered in this browser. You can switch back to SFW anytime.</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={enable}>
                Enable NSFW
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
