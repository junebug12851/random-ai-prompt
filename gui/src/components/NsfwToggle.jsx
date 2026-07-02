/**
 * The header NSFW switch. The whole app defaults to SFW; this is the only control
 * that lets adult content through (it flips `settings.includeAdult`, which the engine
 * gates on). Turning it ON requires an explicit confirmation; turning it OFF is
 * immediate. The choice rides in `settings` and so is remembered in this browser.
 *
 * In the online build the switch is `locked`: it renders greyed with a tooltip and, when clicked,
 * opens the full-version page instead of toggling (adult content needs the local desktop app).
 * @module gui/components/NsfwToggle
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { lockedHint, openFullVersion } from "../lib/online.js";

const msgs = defineMessages({
  nsfwContent: {
    id: "nsfw.feature",
    defaultMessage: "NSFW content",
    description: "Feature noun phrase used in the online-locked tooltip",
  },
  titleOn: {
    id: "nsfw.titleOn",
    defaultMessage: "Adult content is on — click to switch back to SFW",
  },
  titleOff: { id: "nsfw.titleOff", defaultMessage: "Show adult (NSFW) content" },
  confirmTitle: { id: "nsfw.confirmTitle", defaultMessage: "Show adult content?" },
  confirmBody: {
    id: "nsfw.confirmBody",
    defaultMessage:
      "Enabling NSFW unlocks explicit adult words, artists, and generators in prompts and previews. Only continue if you are 18 or older and want to see this material.",
  },
  confirmNote: {
    id: "nsfw.confirmNote",
    defaultMessage: "Your choice is remembered in this browser. You can switch back to SFW anytime.",
  },
  cancel: { id: "nsfw.cancel", defaultMessage: "Cancel" },
  enable: { id: "nsfw.enable", defaultMessage: "Enable NSFW" },
});

/**
 * @param {object} props
 * @param {object} props.settings The current settings (`includeAdult`).
 * @param {Function} props.setSettings Update the settings.
 * @param {boolean} [props.locked] When true, the switch is disabled (online build) and clicking it
 *   opens the full-version page.
 * @returns {JSX.Element} The right-aligned NSFW switch (+ its confirm dialog).
 */
export default function NsfwToggle({ settings, setSettings, locked = false }) {
  const intl = useIntl();
  const on = !locked && settings.includeAdult === true;
  const [confirming, setConfirming] = useState(false);

  // Escape cancels the confirm dialog.
  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (e) => e.key === "Escape" && setConfirming(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  // Locked (online): clicking sends people to the full version. Otherwise: disabling is immediate;
  // enabling asks first.
  const toggle = () => {
    if (locked) {
      openFullVersion();
      return;
    }
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
        aria-disabled={locked || undefined}
        className={`switch${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
        onClick={toggle}
        title={
          locked
            ? lockedHint(intl, intl.formatMessage(msgs.nsfwContent))
            : on
              ? intl.formatMessage(msgs.titleOn)
              : intl.formatMessage(msgs.titleOff)
        }
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
            <h2 id="nsfw-confirm-title">{intl.formatMessage(msgs.confirmTitle)}</h2>
            <p>{intl.formatMessage(msgs.confirmBody)}</p>
            <p className="modal-note">{intl.formatMessage(msgs.confirmNote)}</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                {intl.formatMessage(msgs.cancel)}
              </button>
              <button type="button" className="btn-danger" onClick={enable}>
                {intl.formatMessage(msgs.enable)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
