/**
 * The header provider-settings gear — a small gear button next to the provider picker that opens a
 * popover holding the active provider's own controls (`ProviderBox`). This keeps the provider's
 * knobs (model / size / sampler / negative prompt / …) out of the main prompt area while staying
 * one click from the provider selection. The popover header shows the provider's label + tier.
 * @module gui/components/ProviderGear
 */
import { useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getProvider } from "../lib/providers/index.js";
import ProviderBox from "./ProviderBox.jsx";

const msgs = defineMessages({
  tierApi: { id: "providerGear.tier.api", defaultMessage: "image API" },
  tierSyntax: { id: "providerGear.tier.syntax", defaultMessage: "copy-prompt" },
  tierPlain: { id: "providerGear.tier.plain", defaultMessage: "plain text" },
  settings: { id: "providerGear.settings", defaultMessage: "Provider settings" },
  close: { id: "providerGear.close", defaultMessage: "close" },
});

/**
 * The gear cog icon.
 * @returns {JSX.Element}
 */
function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {(JSX.Element|null)}
 */
export default function ProviderGear({ settings, setSettings }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const provider = getProvider(settings.provider);
  if (!provider) return null;

  const tierLabel = intl.formatMessage(
    provider.tier === "api" ? msgs.tierApi : provider.tier === "syntax" ? msgs.tierSyntax : msgs.tierPlain,
  );

  return (
    <div className="field-menu-wrap provider-gear">
      <button
        className={`ps-gear${open ? " on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={intl.formatMessage(msgs.settings)}
        aria-label={intl.formatMessage(msgs.settings)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <GearIcon />
      </button>
      {open && (
        <>
          <div className="gear-pop-scrim" onClick={() => setOpen(false)} />
          <div
            className="gear-pop provider-gear-pop"
            role="dialog"
            aria-label={intl.formatMessage(msgs.settings)}
          >
            <div className="gear-pop-head">
              <span className="gear-pop-title">
                <span className="gph-label">{provider.label}</span>
                <span className="provider-tag">{tierLabel}</span>
              </span>
              <button className="link-btn" onClick={() => setOpen(false)}>
                {intl.formatMessage(msgs.close)}
              </button>
            </div>
            <div className="gear-pop-body">
              <ProviderBox settings={settings} setSettings={setSettings} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
