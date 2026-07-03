/**
 * The header "Appearance" control: an icon button that opens a popover for
 * choosing the base mode (System / Dark / Light) and the theme/accent. The
 * accent grid lists every theme in the registry — built-in system themes plus
 * any imported user themes — and offers Import / Export of theme files. Reads
 * and writes the live theme via `useTheme()`.
 * @module gui/components/ThemePicker
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { useTheme } from "../theme/ThemeProvider.jsx";
import { parseThemeFile, serializeTheme } from "../theme/themeFile.js";
import { PaletteIcon, SunIcon, MoonIcon, MonitorIcon } from "./icons.jsx";

const msgs = defineMessages({
  appearance: { id: "theme.appearance", defaultMessage: "Appearance" },
  mode: { id: "theme.mode", defaultMessage: "Mode" },
  system: { id: "theme.system", defaultMessage: "System" },
  dark: { id: "theme.dark", defaultMessage: "Dark" },
  light: { id: "theme.light", defaultMessage: "Light" },
  accent: { id: "theme.accent", defaultMessage: "Accent" },
  importTheme: { id: "theme.import", defaultMessage: "Import theme…" },
  exportTheme: { id: "theme.export", defaultMessage: "Export" },
  removeTheme: { id: "theme.remove", defaultMessage: "Remove {name}" },
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
  const { mode, setMode, accent, setAccent, themes, userThemeIds, addUserTheme, removeUserTheme } =
    useTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // Close on Escape (matches the links menu).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const res = parseThemeFile(await file.text());
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError("");
    addUserTheme(res.theme);
    setAccent(res.theme.id);
  }

  function onExport() {
    const theme = themes.find((t) => t.id === accent) || themes[0];
    if (!theme) return;
    const blob = new Blob([serializeTheme(theme)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.id}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <span className="ctl-label">{intl.formatMessage(msgs.appearance)}</span>
      </button>
      {open && (
        <>
          <div className="theme-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="theme-pop" role="dialog" aria-label={intl.formatMessage(msgs.appearance)}>
            <div className="theme-section">
              <div className="theme-section-label" id="theme-mode-label">
                {intl.formatMessage(msgs.mode)}
              </div>
              <div className="theme-segmented" role="radiogroup" aria-labelledby="theme-mode-label">
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
              <div className="theme-swatches" role="radiogroup" aria-labelledby="theme-accent-label">
                {themes.map((t) => (
                  <span className="theme-swatch-wrap" key={t.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={accent === t.id}
                      className={`theme-swatch${accent === t.id ? " on" : ""}`}
                      style={{ "--sw": t.swatch }}
                      onClick={() => setAccent(t.id)}
                      title={t.label}
                      aria-label={t.label}
                    />
                    {userThemeIds.includes(t.id) && (
                      <button
                        type="button"
                        className="theme-swatch-del"
                        onClick={() => removeUserTheme(t.id)}
                        title={intl.formatMessage(msgs.removeTheme, { name: t.label })}
                        aria-label={intl.formatMessage(msgs.removeTheme, { name: t.label })}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <div className="theme-file-actions">
                <button
                  type="button"
                  className="theme-file-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  {intl.formatMessage(msgs.importTheme)}
                </button>
                <button type="button" className="theme-file-btn" onClick={onExport}>
                  {intl.formatMessage(msgs.exportTheme)}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={onImport}
                />
              </div>
              {error && (
                <div className="theme-file-error" role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
