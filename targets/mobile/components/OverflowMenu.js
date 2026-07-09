import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking } from "react-native";
import { T } from "../lib/theme.js";
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
// The app's own legal pages, served from the deployed web app (prompt.fairyfox.io/legal/*).
const LEGAL_BASE = "https://prompt.fairyfox.io/legal";

// The same link set + order as the web LinksMenu (which folds into the header overflow on phones):
// project links, then a "get it" group, then the legal pages. Grouped by separators.
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

/**
 * The header ⋯ overflow menu — a dropdown anchored under the top bar, mirroring the web's
 * `topbar-controls` overflow. Folds in the project links + legal pages + version (the web's
 * compact LinksMenu). Providers / NSFW / Theme rows will slot in here as those features land.
 * @param {{ visible: boolean, onClose: () => void, top: number }} props
 */
export default function OverflowMenu({ visible, onClose, top }) {
  const open = (url) => {
    onClose();
    Linking.openURL(url).catch(() => {});
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.panel, { top }]}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: "absolute",
    right: 12,
    width: 288,
    maxWidth: "84%",
    maxHeight: "76%",
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: T.radiusSm,
  },
  rowIcon: { width: 20, alignItems: "center" },
  rowText: { flex: 1 },
  rowLabel: { color: T.fg, fontSize: 14.5, fontWeight: "700" },
  rowDesc: { color: T.muted, fontSize: 12, marginTop: 1 },
  sep: { height: 1, backgroundColor: T.borderSoft, marginVertical: 6, marginHorizontal: 6 },
  version: {
    color: T.faint,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
  },
});
