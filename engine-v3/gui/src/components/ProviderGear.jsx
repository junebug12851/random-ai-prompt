/**
 * The header provider-settings gear — a small gear button next to the provider picker that opens a
 * popover holding an **accordion** of the chosen providers' own controls (`ProviderBox`): one
 * section per role — Image (always), Text (when a rewrite AI is set), and Upscale (when an upscaler
 * is set). This keeps every provider's knobs (model / size / sampler / negative prompt / …) out of
 * the main prompt area while staying one click from the provider selection. Each section header
 * shows that provider's label + tier and toggles its body open/closed.
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
  none: {
    id: "providerGear.none",
    defaultMessage: "No provider selected — pick one in the Providers menu to see its settings.",
  },
  roleImage: { id: "providerGear.role.image", defaultMessage: "Image" },
  roleText: { id: "providerGear.role.text", defaultMessage: "Text" },
  roleUpscale: { id: "providerGear.role.upscale", defaultMessage: "Upscale" },
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
 * One accordion section: a provider role's header (label + tier) over its collapsible `ProviderBox`.
 * @param {object} props
 * @param {string} props.role Localized role name (Image / Text / Upscale).
 * @param {object} props.provider The provider manifest.
 * @param {boolean} props.open Whether the section body is expanded.
 * @param {Function} props.onToggle Toggle this section.
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
function GearSection({ role, provider, open, onToggle, settings, setSettings }) {
  const intl = useIntl();
  const tierLabel = intl.formatMessage(
    provider.tier === "api" ? msgs.tierApi : provider.tier === "syntax" ? msgs.tierSyntax : msgs.tierPlain,
  );
  return (
    <div className={`gear-acc-item${open ? " on" : ""}`}>
      <button
        className="gear-acc-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="gear-acc-caret" aria-hidden="true">
          ▸
        </span>
        <span className="gear-acc-role">{role}</span>
        <span className="gear-acc-name">{provider.label}</span>
        <span className="provider-tag">{tierLabel}</span>
      </button>
      {open && (
        <div className="gear-acc-body">
          <ProviderBox settings={settings} setSettings={setSettings} providerId={provider.id} />
        </div>
      )}
    </div>
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
  // Which accordion sections are expanded — Image leads, expanded by default.
  const [expanded, setExpanded] = useState(() => new Set(["image"]));
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Each role may be unset ("none") — the image too (prompts only). Only set roles get a section.
  const imageId = settings.provider && settings.provider !== "none" ? settings.provider : null;
  const textId =
    settings.rewriteProvider && settings.rewriteProvider !== "none" ? settings.rewriteProvider : null;
  const upscaleId =
    settings.upscaleProvider && settings.upscaleProvider !== "none" ? settings.upscaleProvider : null;
  const image = imageId ? getProvider(imageId) : null;
  const text = textId ? getProvider(textId) : null;
  const upscale = upscaleId ? getProvider(upscaleId) : null;

  const sections = [
    image && { id: "image", role: intl.formatMessage(msgs.roleImage), provider: image },
    text && { id: "text", role: intl.formatMessage(msgs.roleText), provider: text },
    upscale && { id: "upscale", role: intl.formatMessage(msgs.roleUpscale), provider: upscale },
  ].filter(Boolean);

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
              <span className="gear-pop-title">{intl.formatMessage(msgs.settings)}</span>
              <button className="link-btn" onClick={() => setOpen(false)}>
                {intl.formatMessage(msgs.close)}
              </button>
            </div>
            <div className="gear-pop-body">
              {sections.length ? (
                <div className="gear-acc">
                  {sections.map((s) => (
                    <GearSection
                      key={s.id}
                      role={s.role}
                      provider={s.provider}
                      open={expanded.has(s.id)}
                      onToggle={() => toggle(s.id)}
                      settings={settings}
                      setSettings={setSettings}
                    />
                  ))}
                </div>
              ) : (
                <p className="hint provider-controls-empty">{intl.formatMessage(msgs.none)}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
