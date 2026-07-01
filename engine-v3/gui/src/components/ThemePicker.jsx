/**
 * The header "Appearance" control: an icon button that opens a small popover for
 * choosing the base mode (System / Dark / Light) and the accent colour. Lives in
 * the top bar next to the links menu. Reads and writes the live theme via
 * `useTheme()` — changes apply instantly (and persist through settings).
 * @module gui/components/ThemePicker
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { useTheme } from "../theme/ThemeProvider.jsx";
import { ACCENTS } from "../theme/presets.js";
import { PaletteIcon, SunIcon, MoonIcon, MonitorIcon } from "./icons.jsx";

const msgs = defineMessages({
  appearance: { id: "theme.appearance", defaultMessage: "Appearance" },
  mode: { id: "theme.mode", defaultMessage: "Mode" },
  system: { id: "theme.system", defaultMessage: "System" },
  dark: { id: "theme.dark", defaultMessage: "Dark" },
  light: { id: "theme.light", defaultMessage: "Light" },
  accent: { id: "theme.accent", defaultMessage: "Accent" },
});

const MODES = [
  { id: "system", label: msgs.system, Icon: MonitorIcon },
  { id: "dark", label: msgs.dark, Icon: MoonIcon },
  { id: "light", label: msgs.light, Icon: SunIcon },
];

/**
 * @returns {JSX.Element} The header appearance (theme) picker.
 */
export default function ThemePicker() {
  const intl = useIntl();
  const { mode, setMode, accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);

  // Close on Escape (matches the links menu).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="theme-menu">
      <button
        className={`theme-trigger${open ? " on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={intl.formatMessage(msgs.appearance)}
        aria-label={intl.formatMessage(msgs.appearance)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <PaletteIcon />
      </button>
      {open && (
        <>
          <div className="theme-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="theme-pop"
            role="dialog"
            aria-label={intl.formatMessage(msgs.appearance)}
          >
            <div className="theme-section">
              <div className="theme-section-label" id="theme-mode-label">
                {intl.formatMessage(msgs.mode)}
              </div>
              <div
                className="theme-segmented"
                role="radiogroup"
                aria-labelledby="theme-mode-label"
              >
                {MODES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={mode === id}
                    className={`theme-seg${mode === id ? " on" : ""}`}
                    onClick={() => setMode(id)}
                  >
                    <Icon />
                    <span>{intl.formatMessage(label)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-section">
              <div className="theme-section-label" id="theme-accent-label">
                {intl.formatMessage(msgs.accent)}
              </div>
              <div
                className="theme-swatches"
                role="radiogroup"
                aria-labelledby="theme-accent-label"
              >
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={accent === a.id}
                    className={`theme-swatch${accent === a.id ? " on" : ""}`}
                    style={{ "--sw": a.swatch }}
                    onClick={() => setAccent(a.id)}
                    title={a.label}
                    aria-label={a.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
