/**
 * The header **app-settings** cog — a small gear button in the top bar (distinct from the
 * provider-settings gear next door) that opens a popover of app-wide preferences. Today that's the
 * display language; it's the home for future app-level (non-prompt, non-provider) settings too.
 * The language picker used to live in the prompt-settings gear (`Settings`), which mixed an app
 * preference in with prompt knobs — it now lives here, on every tab.
 * @module gui/components/AppMenu
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { Select, Group } from "./Field.jsx";
import { AUTO_LOCALE, SUPPORTED_LOCALES, LOCALES } from "../i18n/index.js";

const msgs = defineMessages({
  appSettings: { id: "appMenu.appSettings", defaultMessage: "App settings" },
  close: { id: "appMenu.close", defaultMessage: "close" },
  groupLanguage: { id: "appMenu.group.language", defaultMessage: "Language" },
  localeLabel: { id: "appMenu.locale", defaultMessage: "Display language" },
  localeAuto: {
    id: "appMenu.locale.auto",
    defaultMessage: "Auto (browser)",
    description: "Locale option that follows the browser's language",
  },
});

/**
 * The app-settings cog icon (a small sliders glyph, to read distinctly from the provider gear).
 * @returns {JSX.Element}
 */
function SlidersIcon() {
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
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function AppMenu({ settings, setSettings }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const localeOptions = [
    { value: AUTO_LOCALE, label: intl.formatMessage(msgs.localeAuto) },
    ...SUPPORTED_LOCALES.map((code) => ({ value: code, label: LOCALES[code].label })),
  ];

  return (
    <div className="field-menu-wrap app-menu">
      <button
        className={`ps-gear${open ? " on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={intl.formatMessage(msgs.appSettings)}
        aria-label={intl.formatMessage(msgs.appSettings)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersIcon />
      </button>
      {open && (
        <>
          <div className="gear-pop-scrim" onClick={() => setOpen(false)} />
          <div className="gear-pop app-menu-pop" role="dialog" aria-label={intl.formatMessage(msgs.appSettings)}>
            <div className="gear-pop-head">
              <span className="gear-pop-title">{intl.formatMessage(msgs.appSettings)}</span>
              <button className="link-btn" onClick={() => setOpen(false)}>
                {intl.formatMessage(msgs.close)}
              </button>
            </div>
            <div className="gear-pop-body">
              <Group title={intl.formatMessage(msgs.groupLanguage)}>
                <Select
                  label={intl.formatMessage(msgs.localeLabel)}
                  value={settings.locale ?? AUTO_LOCALE}
                  onChange={(v) => setSettings({ ...settings, locale: v })}
                  options={localeOptions}
                />
              </Group>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
