/**
 * Mobile theming — the counterpart to the web's ThemeProvider + tokens.css. Provides the semantic
 * token object `T` for the current base (System / Dark / Light) and accent, plus setters, over React
 * context. Choices persist to the app's document dir. Mirrors the web palettes + the 9 accent presets
 * (theme/themes/*.json). Components read `const { T } = useTheme()` and build their styles from it.
 */
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { ACCENTS, DEFAULT_ACCENT, LOCALES, DEFAULT_LOCALE } from "./themeData.js";

// Re-export so existing consumers keep importing these from lib/theme.js unchanged. The data lives in
// the RN-free themeData.js so the parity check can import it in Node.
export { ACCENTS, DEFAULT_ACCENT, LOCALES, DEFAULT_LOCALE };

const FS = Platform.OS === "web" ? null : require("expo-file-system/legacy");
const FILE = FS ? `${FS.documentDirectory}rap-theme.json` : null;

// Neutral palettes — foundation/tokens.css primitives.
const DARK = {
  bg: "#1c1c1f",
  input: "#2a2a2f",
  panel: "#232328",
  panel2: "#26262c",
  elevated: "#2c2c33",
  chip: "#2a2a31",
  chipHover: "#34343d",
  fg: "#fafafa",
  fgSoft: "#d6d6dc",
  muted: "#aaaab2",
  faint: "#97979f",
  border: "#34343c",
  borderSoft: "#2b2b32",
};
const LIGHT = {
  bg: "#f5f5f7",
  input: "#ffffff",
  panel: "#ffffff",
  panel2: "#fafafb",
  elevated: "#ffffff",
  chip: "#eeeef1",
  chipHover: "#e3e3e8",
  fg: "#18181b",
  fgSoft: "#2c2c31",
  muted: "#6a6a73",
  faint: "#9a9aa2",
  border: "#e2e2e7",
  borderSoft: "#ededf1",
};
// Danger + scales are base-independent.
const DANGER = { dangerBorder: "#6b2230", dangerBg: "#3a1620", dangerFg: "#ffb3c0" };
const SCALES = { radius: 14, radiusSm: 10, radiusPill: 999 };

const MINT_STRONG = "#21c98a"; // the mint --accent-strong (others derive to their own accent)

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Build the semantic token object for a resolved base ("dark"|"light") + accent id. */
export function buildTokens(resolved, accentId) {
  const base = resolved === "light" ? LIGHT : DARK;
  const preset = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const tone = resolved === "light" ? preset.light : preset.dark;
  return {
    ...base,
    ...DANGER,
    ...SCALES,
    accent: tone.accent,
    accentStrong: preset.id === "mint" ? MINT_STRONG : tone.accent,
    accentInk: tone.ink,
    accentSoft: hexToRgba(tone.accent, 0.14),
  };
}

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [mode, setMode] = useState("system"); // "system" | "dark" | "light"
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [locale, setLocale] = useState(DEFAULT_LOCALE); // "auto" | "en"
  const [provider, setProvider] = useState(""); // selected image provider id ("" = none)
  const [providerSettings, setProviderSettings] = useState({}); // { [providerId]: { model, size, … } }
  const [ready, setReady] = useState(false);

  const setProviderSetting = (id, key, val) =>
    setProviderSettings((s) => ({ ...s, [id]: { ...s[id], [key]: val } }));

  // Load the persisted choice once.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (FS) {
        try {
          const info = await FS.getInfoAsync(FILE);
          if (info.exists) {
            const j = JSON.parse(await FS.readAsStringAsync(FILE));
            if (alive) {
              if (j.mode) setMode(j.mode);
              if (j.accent) setAccent(j.accent);
              if (j.locale) setLocale(j.locale);
              if (j.provider != null) setProvider(j.provider);
              if (j.providerSettings) setProviderSettings(j.providerSettings);
            }
          }
        } catch {
          /* first run / unreadable — keep defaults */
        }
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist after the initial load (so we don't clobber the saved file with defaults).
  useEffect(() => {
    if (!ready || !FS) return;
    FS.writeAsStringAsync(
      FILE,
      JSON.stringify({ mode, accent, locale, provider, providerSettings }),
    ).catch(() => {});
  }, [mode, accent, locale, provider, providerSettings, ready]);

  const resolved = mode === "system" ? (system === "light" ? "light" : "dark") : mode;
  const T = useMemo(() => buildTokens(resolved, accent), [resolved, accent]);
  const value = useMemo(
    () => ({
      T,
      mode,
      setMode,
      accent,
      setAccent,
      accents: ACCENTS,
      locale,
      setLocale,
      locales: LOCALES,
      provider,
      setProvider,
      providerSettings,
      setProviderSetting,
      resolved,
      ready,
    }),
    [T, mode, accent, locale, provider, providerSettings, resolved, ready],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** The theme hook. Falls back to dark+mint if used outside the provider (e.g. web-render probes). */
export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (ctx) return ctx;
  return {
    T: buildTokens("dark", DEFAULT_ACCENT),
    mode: "system",
    setMode: () => {},
    accent: DEFAULT_ACCENT,
    setAccent: () => {},
    accents: ACCENTS,
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    locales: LOCALES,
    provider: "",
    setProvider: () => {},
    providerSettings: {},
    setProviderSetting: () => {},
    resolved: "dark",
    ready: true,
  };
}
