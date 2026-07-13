import { useState, useCallback, useMemo, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./lib/theme.js";
import { MoreIcon } from "./lib/icons.js";
import { refreshOverlay } from "./lib/overlay.js";
import { initProviderSchemas, providerSchemasReady } from "./lib/imageProviders.js";
import OverflowMenu from "./components/OverflowMenu.js";
import ContentColumn from "./components/ContentColumn.js";
import GenerateScreen from "./screens/GenerateScreen.js";
import GalleryScreen from "./screens/GalleryScreen.js";
import SingleScreen from "./screens/SingleScreen.js";
import ManageScreen from "./screens/ManageScreen.js";

const TABS = [
  { id: "generate", label: "Generate" },
  { id: "gallery", label: "Gallery" },
  { id: "single", label: "Single" },
  { id: "manage", label: "Manage" },
];

// Top bar mirroring the web SPA's phone header (title-bar.css + topbar-responsive.css): the brand mark
// (the app logo; the wordmark is hidden on phones), the enclosed pill view-switch (active tab filled
// with accent-strong), a spacer, and the ⋯ overflow that opens the controls menu (the project links +
// legal pages + version — the web's compact LinksMenu). Panes stay MOUNTED (visibility toggled).
export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function Root() {
  const { T, resolved } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const insets = useSafeAreaInsets();
  const [view, setView] = useState("generate");
  const [image, setImage] = useState(null);
  const [galleryKey, setGalleryKey] = useState(0);
  const [gallerySearch, setGallerySearch] = useState({ term: "", seq: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  // Install the on-device Manage overlay (custom lists + blocks) into the engine at startup so prompts
  // draw from the user's own content. ManageScreen refreshes it again after each edit.
  useEffect(() => {
    refreshOverlay().catch(() => {});
  }, []);

  // Preload every provider's settings schema (from the SHARED registry) once at boot, so the
  // provider gear/knobs can be read synchronously everywhere. The web code-splits its schemas
  // lazily; on a phone the bundle already ships them, so there's nothing to defer. Flipping this
  // state re-renders the mounted screens with their knobs filled in.
  const [, setSchemasReady] = useState(providerSchemasReady());
  useEffect(() => {
    initProviderSchemas()
      .then(() => setSchemasReady(true))
      .catch(() => setSchemasReady(true)); // never leave the UI stuck on "no providers"
  }, []);

  const openImage = useCallback((it) => {
    setImage(it);
    setView("single");
  }, []);
  // Keyword-cloud search from the Single view: jump to the Gallery pre-filtered to the tapped tag.
  const searchFromSingle = useCallback((term) => {
    setGallerySearch((s) => ({ term, seq: s.seq + 1 }));
    setView("gallery");
  }, []);
  const afterDelete = useCallback(() => {
    setImage(null);
    setGalleryKey((k) => k + 1);
    setView("gallery");
  }, []);

  const pane = (id) => [styles.pane, view === id ? null : styles.hidden];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style={resolved === "light" ? "dark" : "light"} />
      <View style={styles.topbar}>
        <Image source={require("./assets/logo.png")} style={styles.logo} resizeMode="contain" />

        <View style={styles.switch}>
          {TABS.map((t) => {
            const on = view === t.id;
            return (
              <TouchableOpacity accessibilityRole="button"
                key={t.id}
                style={[styles.tab, on && styles.tabOn]}
                onPress={() => setView(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity accessibilityRole="button" style={styles.more} activeOpacity={0.7} onPress={() => setMenuOpen(true)} accessibilityLabel="More options">
          <MoreIcon size={20} color={T.fgSoft} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Reading/editing surfaces get the web's centered max-width column on tablet/wide (via
            ContentColumn); the Gallery grid opts out and uses the full width itself. No feature changes
            with size — only the column width. */}
        <View style={pane("generate")}>
          <ContentColumn>
            <GenerateScreen onOpenImage={openImage} onGenerated={() => setGalleryKey((k) => k + 1)} />
          </ContentColumn>
        </View>
        <View style={pane("gallery")}>
          <GalleryScreen
            onOpen={openImage}
            refreshKey={galleryKey}
            onGenerated={() => setGalleryKey((k) => k + 1)}
            searchTerm={gallerySearch.term}
            searchSeq={gallerySearch.seq}
          />
        </View>
        <View style={pane("single")}>
          <ContentColumn max={1100}>
            <SingleScreen
              image={image}
              onBack={() => setView("gallery")}
              onDeleted={afterDelete}
              onUpscaled={() => setGalleryKey((k) => k + 1)}
              onSearch={searchFromSingle}
            />
          </ContentColumn>
        </View>
        <View style={pane("manage")}>
          <ContentColumn>
            <ManageScreen />
          </ContentColumn>
        </View>
      </View>

      <OverflowMenu visible={menuOpen} onClose={() => setMenuOpen(false)} top={insets.top + 62} />
    </SafeAreaView>
  );
}

const R = 44; // overflow toggle size

const makeStyles = (T) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },
    topbar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    logo: { width: 32, height: 32, borderRadius: 8 },
    // enclosed pill switch (view-switch.css)
    switch: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: T.input,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 3,
      paddingVertical: 3,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: T.radiusPill,
    },
    tabOn: { backgroundColor: T.accentStrong },
    tabText: { color: T.muted, fontSize: 13, fontWeight: "700" },
    tabTextOn: { color: T.accentInk, fontWeight: "800" },
    more: {
      width: R,
      height: R,
      borderRadius: R / 2,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.input,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1 },
    pane: { ...StyleSheet.absoluteFillObject },
    hidden: { display: "none" },
  });
