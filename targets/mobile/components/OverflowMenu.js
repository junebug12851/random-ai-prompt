import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
} from "react-native";
import { useTheme } from "../lib/theme.js";
import { IMAGE_PROVIDERS, getImageProvider } from "../lib/imageProviders.js";
import { getKey, setKey } from "../lib/keys.js";
import {
  GitHubIcon,
  BookIcon,
  HomeIcon,
  DownloadIcon,
  ServerIcon,
  ShieldIcon,
  FileTextIcon,
  CookieIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  CheckIcon,
} from "../lib/icons.js";

// Keep in sync with the repo VERSION / package.json (the web reads it from lib/version.js at build).
const APP_VERSION = "2.51.1";

const LINKS = {
  github: "https://github.com/junebug12851/random-ai-prompt",
  releases: "https://github.com/junebug12851/random-ai-prompt/releases",
  selfhost: "https://github.com/junebug12851/random-ai-prompt#how-to-get-it",
  docs: "https://fairyfox.io/random-ai-prompt/",
  home: "https://fairyfox.io",
};
const LEGAL_BASE = "https://prompt.fairyfox.io/legal";

const GROUPS = [
  [
    {
      url: LINKS.github,
      Icon: GitHubIcon,
      label: "GitHub repository",
      desc: "Source code, issues, and releases",
      external: true,
    },
    {
      url: LINKS.docs,
      Icon: BookIcon,
      label: "Project docs",
      desc: "API reference and developer guide",
      external: true,
    },
    {
      url: LINKS.home,
      Icon: HomeIcon,
      label: "fairyfox.io",
      desc: "The fairyfox project home",
      external: true,
    },
  ],
  [
    {
      url: LINKS.releases,
      Icon: DownloadIcon,
      label: "Get the desktop app",
      desc: "Pre-built downloads for Windows, macOS, and Linux",
      external: true,
    },
    {
      url: LINKS.selfhost,
      Icon: ServerIcon,
      label: "Run it yourself",
      desc: "Self-host the online edition or build from source",
      external: true,
    },
  ],
  [
    {
      url: `${LEGAL_BASE}/privacy.html`,
      Icon: ShieldIcon,
      label: "Privacy Policy",
      desc: "What we collect (almost nothing)",
    },
    {
      url: `${LEGAL_BASE}/terms.html`,
      Icon: FileTextIcon,
      label: "Terms & Conditions",
      desc: "The rules for using the app",
    },
    {
      url: `${LEGAL_BASE}/cookies.html`,
      Icon: CookieIcon,
      label: "Cookies Policy",
      desc: "We don't use cookies",
    },
  ],
];

const MODES = [
  { id: "system", label: "System", Icon: MonitorIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "light", label: "Light", Icon: SunIcon },
];

/**
 * The header ⋯ overflow menu — a dropdown anchored under the top bar, mirroring the web's
 * `topbar-controls` overflow. Appearance (theme mode + accent, the web ThemePicker) folds in on top,
 * then the project links + legal pages + version (the web's compact LinksMenu). Providers / API keys
 * and the language picker slot in here as those features land.
 * @param {{ visible: boolean, onClose: () => void, top: number }} props
 */
export default function OverflowMenu({ visible, onClose, top }) {
  const {
    T,
    mode,
    setMode,
    accent,
    setAccent,
    accents,
    locale,
    setLocale,
    locales,
    provider,
    setProvider,
  } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [apiKey, setApiKey] = useState("");
  const sel = getImageProvider(provider);

  // Load the stored key for the selected provider (from the OS keystore).
  useEffect(() => {
    let alive = true;
    if (provider) getKey(provider).then((k) => alive && setApiKey(k));
    else setApiKey("");
    return () => {
      alive = false;
    };
  }, [provider]);

  const onKeyChange = (v) => {
    setApiKey(v);
    setKey(provider, v);
  };

  const open = (url) => {
    onClose();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.panel, { top }]}>
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Image provider (BYOK) — the web ProvidersMenu + ProviderGear key field. Only the
                browser-direct providers that work without a backend are listed. */}
            <Text style={styles.sectionLabel}>IMAGE PROVIDER</Text>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setProvider("")}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, { flex: 1 }]}>None — prompts only</Text>
              {provider === "" && <CheckIcon size={16} color={T.accent} />}
            </TouchableOpacity>
            {IMAGE_PROVIDERS.map((pv) => (
              <TouchableOpacity
                key={pv.id}
                style={styles.row}
                onPress={() => setProvider(pv.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowLabel, { flex: 1 }]}>{pv.label}</Text>
                {provider === pv.id && <CheckIcon size={16} color={T.accent} />}
              </TouchableOpacity>
            ))}
            {sel && (
              <>
                <TextInput
                  style={styles.keyInput}
                  value={apiKey}
                  onChangeText={onKeyChange}
                  placeholder={`API key (${sel.keyHint})`}
                  placeholderTextColor={T.faint}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.provFoot}>
                  <Text style={styles.provNote}>Stored securely on your device (BYOK).</Text>
                  {sel.keyUrl && (
                    <TouchableOpacity onPress={() => open(sel.keyUrl)}>
                      <Text style={styles.provLink}>Get a key ↗</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <View style={styles.sep} />

            {/* Appearance — the web ThemePicker (mode + accent). */}
            <Text style={styles.sectionLabel}>APPEARANCE</Text>
            <View style={styles.segmented}>
              {MODES.map(({ id, label, Icon }) => {
                const on = mode === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.seg, on && styles.segOn]}
                    onPress={() => setMode(id)}
                    activeOpacity={0.8}
                  >
                    <Icon size={15} color={on ? T.accent : T.muted} />
                    <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.swatches}>
              {accents.map((a) => {
                const on = accent === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.swatchWrap, on && styles.swatchWrapOn]}
                    onPress={() => setAccent(a.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.swatch, { backgroundColor: a.swatch }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sep} />

            {/* Language — folds in above the links, like the web LinksMenu. English-only for now. */}
            <Text style={styles.sectionLabel}>LANGUAGE</Text>
            {locales.map((l) => {
              const on = locale === l.id;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={styles.row}
                  onPress={() => setLocale(l.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowLabel, { flex: 1 }]}>{l.label}</Text>
                  {on && <CheckIcon size={16} color={T.accent} />}
                </TouchableOpacity>
              );
            })}
            <Text style={styles.langNote}>English is the only language for now.</Text>

            <View style={styles.sep} />

            {GROUPS.map((items, gi) => (
              <View key={gi}>
                {gi > 0 && <View style={styles.sep} />}
                {items.map(({ url, Icon, label, desc, external }) => (
                  <TouchableOpacity
                    key={url}
                    style={styles.row}
                    onPress={() => open(url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIcon}>
                      <Icon size={18} color={T.muted} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowDesc} numberOfLines={1}>
                        {desc}
                      </Text>
                    </View>
                    {external && <ExternalLinkIcon size={14} color={T.faint} />}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.sep} />
            <Text style={styles.version}>v{APP_VERSION}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    root: { flex: 1 },
    panel: {
      position: "absolute",
      right: 12,
      width: 300,
      maxWidth: "88%",
      maxHeight: "80%",
      backgroundColor: T.panel,
      borderWidth: 1,
      borderColor: T.border,
      borderRadius: T.radius,
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    body: { padding: 10 },
    sectionLabel: {
      color: T.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 8,
      marginLeft: 4,
    },

    segmented: { flexDirection: "row", gap: 6, marginBottom: 12 },
    seg: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    segOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
    segText: { color: T.muted, fontSize: 12.5, fontWeight: "700" },
    segTextOn: { color: T.accent },

    swatches: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      paddingHorizontal: 2,
      marginBottom: 4,
    },
    swatchWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchWrapOn: { borderColor: T.fg },
    swatch: { width: 24, height: 24, borderRadius: 12 },

    sep: { height: 1, backgroundColor: T.borderSoft, marginVertical: 8, marginHorizontal: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 8,
      paddingVertical: 11,
      borderRadius: T.radiusSm,
    },
    rowIcon: { width: 20, alignItems: "center" },
    rowText: { flex: 1 },
    rowLabel: { color: T.fg, fontSize: 14.5, fontWeight: "700" },
    rowDesc: { color: T.muted, fontSize: 12, marginTop: 1 },
    version: {
      color: T.faint,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8,
    },
    langNote: { color: T.faint, fontSize: 11.5, marginTop: 4, marginLeft: 8 },
    keyInput: {
      marginTop: 8,
      marginHorizontal: 4,
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    provFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
      marginHorizontal: 8,
    },
    provNote: { color: T.faint, fontSize: 11.5, flex: 1 },
    provLink: { color: T.accent, fontSize: 12, fontWeight: "700" },
  });
