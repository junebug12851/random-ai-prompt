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
  PaletteIcon,
  GearIcon,
  ChevronDownIcon,
  CheckIcon,
} from "../lib/icons.js";

// Keep in sync with the repo VERSION / package.json (the web reads it from lib/version.js at build).
const APP_VERSION = "2.51.1";

// Default Server URL for a local provider (its serverKey field's default).
const providerServerDefault = (p) =>
  (p.settings || []).find((f) => f.key === p.serverKey)?.default || "";

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
 * The header ⋯ overflow menu — mirrors the web `topbar-controls` overflow (title-bar / topbar-
 * responsive): a list of compact control ROWS (Providers ▾, Provider settings, Appearance, Language ▾)
 * that drill into their own sub-menus, then the project links + legal pages + version (the folded-in
 * LinksMenu). The NSFW row is intentionally absent — the mobile build is all-ages. Keeps every feature.
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
    providerSettings,
    setProviderSetting,
  } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [sub, setSub] = useState(null); // null | "providers" | "settings" | "appearance" | "language"
  const [apiKey, setApiKey] = useState("");

  const sel = getImageProvider(provider);
  const localeLabel = locales.find((l) => l.id === locale)?.label || "Auto";

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
  const close = () => {
    setSub(null);
    onClose();
  };

  const backHead = (title) => (
    <View style={styles.subHead}>
      <TouchableOpacity onPress={() => setSub(null)} hitSlop={8}>
        <Text style={styles.back}>‹ {title}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
        <View style={[styles.panel, { top }]}>
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {sub === null && (
              <>
                {/* Control rows — each opens its own sub-menu. */}
                <TouchableOpacity
                  style={styles.ctlRow}
                  onPress={() => setSub("providers")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ctlLabel}>Providers</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>
                    {sel ? sel.label.split(" ")[0] : "Unset"}
                  </Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ctlRow}
                  onPress={() => setSub("settings")}
                  activeOpacity={0.7}
                >
                  <GearIcon size={18} color={T.muted} />
                  <Text style={[styles.ctlLabel, { marginLeft: 12 }]}>Provider settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ctlRow}
                  onPress={() => setSub("appearance")}
                  activeOpacity={0.7}
                >
                  <PaletteIcon size={18} color={T.muted} />
                  <Text style={[styles.ctlLabel, { marginLeft: 12 }]}>Appearance</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ctlRow}
                  onPress={() => setSub("language")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ctlLabel}>Language</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>
                    {localeLabel}
                  </Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>

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
              </>
            )}

            {/* --- Providers: pick the image provider + its API key (the web Providers dropdown). --- */}
            {sub === "providers" && (
              <>
                {backHead("Image provider")}
                <TouchableOpacity
                  style={styles.pickRow}
                  onPress={() => setProvider("")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowLabel, { flex: 1 }]}>None — prompts only</Text>
                  {provider === "" && <CheckIcon size={16} color={T.accent} />}
                </TouchableOpacity>
                {IMAGE_PROVIDERS.map((pv) => (
                  <TouchableOpacity
                    key={pv.id}
                    style={styles.pickRow}
                    onPress={() => setProvider(pv.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rowLabel, { flex: 1 }]}>{pv.label}</Text>
                    {provider === pv.id && <CheckIcon size={16} color={T.accent} />}
                  </TouchableOpacity>
                ))}
                {sel && !sel.local && (
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
                {sel && sel.local && (
                  <>
                    <TextInput
                      style={styles.keyInput}
                      value={providerSettings[sel.id]?.[sel.serverKey] ?? providerServerDefault(sel)}
                      onChangeText={(v) => setProviderSetting(sel.id, sel.serverKey, v)}
                      placeholder="http://192.168.1.1:8188"
                      placeholderTextColor={T.faint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <View style={styles.provFoot}>
                      <Text style={styles.provNote}>
                        Your own server on this Wi-Fi (no key). More options in Provider settings.
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}

            {/* --- Provider settings: model / size (the web ProviderGear). --- */}
            {sub === "settings" && (
              <>
                {backHead("Provider settings")}
                {!sel ? (
                  <Text style={styles.emptyNote}>Pick an image provider first (Providers).</Text>
                ) : (
                  (sel.settings || []).map((f) => {
                    const cur = providerSettings[sel.id]?.[f.key] ?? f.default;
                    return (
                      <View key={f.key} style={styles.setBlock}>
                        <Text style={styles.setLabel}>{f.label}</Text>
                        {f.options ? (
                          <View style={styles.chips}>
                            {f.options.map((opt) => {
                              const on = cur === opt;
                              return (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.chip, on && styles.chipOn]}
                                  onPress={() => setProviderSetting(sel.id, f.key, opt)}
                                >
                                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                                    {opt}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <TextInput
                            style={styles.setInput}
                            value={String(cur ?? "")}
                            onChangeText={(v) => setProviderSetting(sel.id, f.key, v)}
                            placeholder={f.placeholder || ""}
                            placeholderTextColor={T.faint}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType={
                              f.type === "number"
                                ? "numbers-and-punctuation"
                                : f.key === sel.serverKey
                                  ? "url"
                                  : "default"
                            }
                          />
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* --- Appearance: mode + accent (the web ThemePicker). --- */}
            {sub === "appearance" && (
              <>
                {backHead("Appearance")}
                <Text style={styles.setLabel}>Mode</Text>
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
                <Text style={[styles.setLabel, { marginTop: 14 }]}>Accent</Text>
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
              </>
            )}

            {/* --- Language (English-only for now, like the web). --- */}
            {sub === "language" && (
              <>
                {backHead("Language")}
                {locales.map((l) => {
                  const on = locale === l.id;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      style={styles.pickRow}
                      onPress={() => setLocale(l.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.rowLabel, { flex: 1 }]}>{l.label}</Text>
                      {on && <CheckIcon size={16} color={T.accent} />}
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.emptyNote}>English is the only language for now.</Text>
              </>
            )}
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
    body: { padding: 8 },

    ctlRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 46,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: T.radiusSm,
    },
    ctlLabel: { color: T.fg, fontSize: 15, fontWeight: "700", flex: 1 },
    ctlValue: { color: T.muted, fontSize: 14, marginRight: 4, maxWidth: 120, textAlign: "right" },

    subHead: { paddingHorizontal: 6, paddingBottom: 8, paddingTop: 2 },
    back: { color: T.accent, fontSize: 15, fontWeight: "800" },
    emptyNote: { color: T.faint, fontSize: 12.5, marginTop: 8, marginHorizontal: 8 },

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: T.radiusSm,
    },
    keyInput: {
      marginTop: 10,
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

    setBlock: { marginBottom: 12 },
    setLabel: {
      color: T.muted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 4,
    },
    setInput: {
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginHorizontal: 2,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    chipOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
    chipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },
    chipTextOn: { color: T.accent },

    segmented: { flexDirection: "row", gap: 6 },
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
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 2 },
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

    sep: { height: 1, backgroundColor: T.borderSoft, marginVertical: 6, marginHorizontal: 4 },
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
  });
