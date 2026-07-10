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
import {
  IMAGE_PROVIDERS,
  TEXT_PROVIDERS,
  UPSCALE_PROVIDERS,
  getImageProvider,
  getTextProvider,
  getUpscaleProvider,
} from "../lib/imageProviders.js";
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

// Keep in sync with the repo VERSION / package.json.
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
    { url: LINKS.github, Icon: GitHubIcon, label: "GitHub repository", desc: "Source code, issues, and releases", external: true },
    { url: LINKS.docs, Icon: BookIcon, label: "Project docs", desc: "API reference and developer guide", external: true },
    { url: LINKS.home, Icon: HomeIcon, label: "fairyfox.io", desc: "The fairyfox project home", external: true },
  ],
  [
    { url: LINKS.releases, Icon: DownloadIcon, label: "Get the desktop app", desc: "Pre-built downloads for Windows, macOS, and Linux", external: true },
    { url: LINKS.selfhost, Icon: ServerIcon, label: "Run it yourself", desc: "Self-host the online edition or build from source", external: true },
  ],
  [
    { url: `${LEGAL_BASE}/privacy.html`, Icon: ShieldIcon, label: "Privacy Policy", desc: "What we collect (almost nothing)" },
    { url: `${LEGAL_BASE}/terms.html`, Icon: FileTextIcon, label: "Terms & Conditions", desc: "The rules for using the app" },
    { url: `${LEGAL_BASE}/cookies.html`, Icon: CookieIcon, label: "Cookies Policy", desc: "We don't use cookies" },
  ],
];

const MODES = [
  { id: "system", label: "System", Icon: MonitorIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "light", label: "Light", Icon: SunIcon },
];

const serverDefault = (p) => (p?.settings || []).find((f) => f.key === p.serverKey)?.default || "http://192.168.1.1:8188";

/**
 * The header ⋯ overflow menu — mirrors the web ProvidersMenu + ThemePicker. The root lists compact
 * control rows (Image ▾ / Text ▾ / Upscale ▾ / ⚙ Provider settings / 🎨 Appearance / Language ▾) that
 * drill into their own sub-menus. Image / Text / Upscale are the web's three provider roles, each a
 * grouped picker (Local / Online) with a BYOK key or local Server URL field. NSFW is intentionally
 * absent — the mobile build is all-ages.
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
    rewriteProvider,
    setRewriteProvider,
    upscaleProvider,
    setUpscaleProvider,
    providerSettings,
    setProviderSetting,
  } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [sub, setSub] = useState(null); // null | "img" | "text" | "up" | "settings" | "appearance" | "language"

  const image = getImageProvider(provider);
  const rewrite = rewriteProvider !== "none" ? getTextProvider(rewriteProvider) : null;
  const upscale = upscaleProvider !== "none" ? getUpscaleProvider(upscaleProvider) : null;
  const localeLabel = locales.find((l) => l.id === locale)?.label || "Auto";

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

  // One selectable provider row (with description + selected check).
  const pickRow = (id, label, desc, selected, onPress) => (
    <TouchableOpacity key={id} style={styles.pickRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc ? (
          <Text style={styles.rowDesc} numberOfLines={2}>
            {desc}
          </Text>
        ) : null}
      </View>
      {selected && <CheckIcon size={16} color={T.accent} />}
    </TouchableOpacity>
  );

  const groupHead = (title) => <Text style={styles.groupHead}>{title}</Text>;

  // BYOK secure key field for the currently-selected provider of a role.
  const keyField = (id, hint, keyUrl) => (
    <KeyField key={`key-${id}`} id={id} hint={hint} keyUrl={keyUrl} styles={styles} T={T} onOpen={open} />
  );
  // Local Server URL field (stored in providerSettings, not secure-store).
  const serverField = (p) => (
    <View key={`srv-${p.id}`}>
      <TextInput
        style={styles.keyInput}
        value={providerSettings[p.id]?.[p.serverKey] ?? serverDefault(p)}
        onChangeText={(v) => setProviderSetting(p.id, p.serverKey, v)}
        placeholder="http://192.168.1.1:8188"
        placeholderTextColor={T.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <View style={styles.provFoot}>
        <Text style={styles.provNote}>Your own server on this Wi-Fi (no key).</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
        <View style={[styles.panel, { top }]}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {sub === null && (
              <>
                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("img")} activeOpacity={0.7}>
                  <Text style={styles.ctlLabel}>Image</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>{image ? image.label.split(" (")[0] : "Unset"}</Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("text")} activeOpacity={0.7}>
                  <Text style={styles.ctlLabel}>Text</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>{rewrite ? rewrite.label.split(" (")[0] : "Off"}</Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("up")} activeOpacity={0.7}>
                  <Text style={styles.ctlLabel}>Upscale</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>{upscale ? upscale.label.split(" (")[0] : "Off"}</Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("settings")} activeOpacity={0.7}>
                  <GearIcon size={18} color={T.muted} />
                  <Text style={[styles.ctlLabel, { marginLeft: 12 }]}>Provider settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("appearance")} activeOpacity={0.7}>
                  <PaletteIcon size={18} color={T.muted} />
                  <Text style={[styles.ctlLabel, { marginLeft: 12 }]}>Appearance</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctlRow} onPress={() => setSub("language")} activeOpacity={0.7}>
                  <Text style={styles.ctlLabel}>Language</Text>
                  <Text style={styles.ctlValue} numberOfLines={1}>{localeLabel}</Text>
                  <ChevronDownIcon size={16} color={T.muted} />
                </TouchableOpacity>

                <View style={styles.sep} />
                {GROUPS.map((items, gi) => (
                  <View key={gi}>
                    {gi > 0 && <View style={styles.sep} />}
                    {items.map(({ url, Icon, label, desc, external }) => (
                      <TouchableOpacity key={url} style={styles.row} onPress={() => open(url)} activeOpacity={0.7}>
                        <View style={styles.rowIcon}><Icon size={18} color={T.muted} /></View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowLabel}>{label}</Text>
                          <Text style={styles.rowDesc} numberOfLines={1}>{desc}</Text>
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

            {/* IMAGE role — grouped Local / Online. */}
            {sub === "img" && (
              <>
                {backHead("Image provider")}
                {groupHead("Local")}
                {IMAGE_PROVIDERS.filter((p) => p.group === "local").map((p) =>
                  pickRow(p.id, p.label, p.description, provider === p.id, () => setProvider(p.id)),
                )}
                {groupHead("Online")}
                {IMAGE_PROVIDERS.filter((p) => p.group === "online").map((p) =>
                  pickRow(p.id, p.label, p.description, provider === p.id, () => setProvider(p.id)),
                )}
                {image && image.local && serverField(image)}
                {image && !image.local && !image.copy && keyField(image.id, image.keyHint, image.keyUrl)}
              </>
            )}

            {/* TEXT / rewrite role — Off + the rewrite AIs (they use each provider's chat model). */}
            {sub === "text" && (
              <>
                {backHead("Text (prompt & keyword rewrite)")}
                {groupHead("Prompt & keyword rewrite")}
                {pickRow("none", "Off", "No prompt or keyword rewriting.", rewriteProvider === "none", () => setRewriteProvider("none"))}
                {TEXT_PROVIDERS.map((p) =>
                  pickRow(p.id, p.label, p.description, rewriteProvider === p.id, () => setRewriteProvider(p.id)),
                )}
                {rewrite && keyField(rewrite.id, rewrite.keyHint, rewrite.keyUrl)}
                <Text style={styles.emptyNote}>Turn it on per run with the wand / tag buttons on the prompt box.</Text>
              </>
            )}

            {/* UPSCALE role — Off + upscalers grouped Local / Online (used in the single-image view). */}
            {sub === "up" && (
              <>
                {backHead("Upscaler / Enhancer")}
                {groupHead("Local")}
                {pickRow("none", "Off", "No upscaler selected.", upscaleProvider === "none", () => setUpscaleProvider("none"))}
                {UPSCALE_PROVIDERS.filter((p) => p.group === "local").map((p) =>
                  pickRow(p.id, p.label, p.description, upscaleProvider === p.id, () => setUpscaleProvider(p.id)),
                )}
                {groupHead("Online")}
                {UPSCALE_PROVIDERS.filter((p) => p.group === "online").map((p) =>
                  pickRow(p.id, p.label, p.description, upscaleProvider === p.id, () => setUpscaleProvider(p.id)),
                )}
                {upscale && upscale.local && serverField({ id: upscale.id, serverKey: upscale.serverKey, settings: getImageProvider(upscale.id)?.settings })}
                {upscale && !upscale.local && keyField(upscale.id, upscale.keyHint, upscale.keyUrl)}
                <Text style={styles.emptyNote}>Used in the single-image view to upscale a saved image.</Text>
              </>
            )}

            {/* Provider settings: the selected IMAGE provider's knobs (model / size / URL / …). */}
            {sub === "settings" && (
              <>
                {backHead("Provider settings")}
                {!image || image.copy ? (
                  <Text style={styles.emptyNote}>Pick an image provider first (Image).</Text>
                ) : (
                  (image.settings || []).map((f) => {
                    const cur = providerSettings[image.id]?.[f.key] ?? f.default;
                    return (
                      <View key={f.key} style={styles.setBlock}>
                        <Text style={styles.setLabel}>{f.label}</Text>
                        {f.options ? (
                          <View style={styles.chips}>
                            {f.options.map((opt) => {
                              const val = typeof opt === "object" ? opt.value : opt;
                              const lab = typeof opt === "object" ? opt.label : opt;
                              const on = cur === val;
                              return (
                                <TouchableOpacity key={String(val)} style={[styles.chip, on && styles.chipOn]} onPress={() => setProviderSetting(image.id, f.key, val)}>
                                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{lab}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <TextInput
                            style={styles.setInput}
                            value={String(cur ?? "")}
                            onChangeText={(v) => setProviderSetting(image.id, f.key, v)}
                            placeholder={f.placeholder || ""}
                            placeholderTextColor={T.faint}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType={f.type === "number" ? "numbers-and-punctuation" : f.key === image.serverKey ? "url" : "default"}
                          />
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* Appearance: mode + accent. */}
            {sub === "appearance" && (
              <>
                {backHead("Appearance")}
                <Text style={styles.setLabel}>Mode</Text>
                <View style={styles.segmented}>
                  {MODES.map(({ id, label, Icon }) => {
                    const on = mode === id;
                    return (
                      <TouchableOpacity key={id} style={[styles.seg, on && styles.segOn]} onPress={() => setMode(id)} activeOpacity={0.8}>
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
                      <TouchableOpacity key={a.id} style={[styles.swatchWrap, on && styles.swatchWrapOn]} onPress={() => setAccent(a.id)} activeOpacity={0.8}>
                        <View style={[styles.swatch, { backgroundColor: a.swatch }]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Language. */}
            {sub === "language" && (
              <>
                {backHead("Language")}
                {locales.map((l) => {
                  const on = locale === l.id;
                  return (
                    <TouchableOpacity key={l.id} style={styles.pickRow} onPress={() => setLocale(l.id)} activeOpacity={0.7}>
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

/** BYOK secure key field bound to a provider id (shared across roles for the same provider). */
function KeyField({ id, hint, keyUrl, styles, T, onOpen }) {
  const [val, setVal] = useState("");
  useEffect(() => {
    let alive = true;
    getKey(id).then((k) => alive && setVal(k || ""));
    return () => {
      alive = false;
    };
  }, [id]);
  const change = (v) => {
    setVal(v);
    setKey(id, v);
  };
  return (
    <>
      <TextInput
        style={styles.keyInput}
        value={val}
        onChangeText={change}
        placeholder={`API key (${hint || "key"})`}
        placeholderTextColor={T.faint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.provFoot}>
        <Text style={styles.provNote}>Stored securely on your device (BYOK).</Text>
        {keyUrl && (
          <TouchableOpacity onPress={() => onOpen(keyUrl)}>
            <Text style={styles.provLink}>Get a key ↗</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    root: { flex: 1 },
    panel: {
      position: "absolute",
      right: 12,
      width: 320,
      maxWidth: "90%",
      maxHeight: "82%",
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
    ctlValue: { color: T.muted, fontSize: 14, marginRight: 4, maxWidth: 130, textAlign: "right" },

    subHead: { paddingHorizontal: 6, paddingBottom: 8, paddingTop: 2 },
    back: { color: T.accent, fontSize: 15, fontWeight: "800" },
    emptyNote: { color: T.faint, fontSize: 12.5, marginTop: 8, marginHorizontal: 8 },
    groupHead: {
      color: T.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 10,
      marginBottom: 2,
      marginLeft: 8,
    },

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: T.radiusSm,
      gap: 8,
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
    version: { color: T.faint, fontSize: 12, fontWeight: "700", textAlign: "center", paddingVertical: 8 },
  });
