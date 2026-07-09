import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { T } from "./lib/theme.js";
import { PencilIcon, MoreIcon } from "./lib/icons.js";
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

// Top bar mirroring the web SPA's phone header, on one row: brand mark (dark rounded square + mint
// pencil), the enclosed pill view-switch (active tab green-filled), and the ⋯ overflow. Panes stay
// MOUNTED (visibility toggled) so each keeps its state + scroll across switches — same as App.jsx.
// SafeAreaView from react-native-safe-area-context (NOT react-native, whose SafeAreaView is a no-op on
// Android) insets the top bar below the status bar so the tabs aren't covered or mis-tappable.
export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [view, setView] = useState("generate");
  const [image, setImage] = useState(null);
  const [galleryKey, setGalleryKey] = useState(0);

  const openImage = useCallback((it) => {
    setImage(it);
    setView("single");
  }, []);
  const afterDelete = useCallback(() => {
    setImage(null);
    setGalleryKey((k) => k + 1);
    setView("gallery");
  }, []);

  const pane = (id) => [styles.pane, view === id ? null : styles.hidden];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <View style={styles.logo}>
          <PencilIcon size={22} color={T.accent} strokeWidth={2.1} />
        </View>

        <View style={styles.switch}>
          {TABS.map((t) => {
            const on = view === t.id;
            return (
              <TouchableOpacity
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

        <TouchableOpacity style={styles.more} activeOpacity={0.7}>
          <MoreIcon size={20} color={T.fgSoft} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={pane("generate")}>
          <GenerateScreen onOpenImage={openImage} />
        </View>
        <View style={pane("gallery")}>
          <GalleryScreen onOpen={openImage} refreshKey={galleryKey} />
        </View>
        <View style={pane("single")}>
          <SingleScreen image={image} onBack={() => setView("gallery")} onDeleted={afterDelete} />
        </View>
        <View style={pane("manage")}>
          <ManageScreen />
        </View>
      </View>
    </SafeAreaView>
  );
}

const R = 46; // brand mark / overflow size

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logo: {
    width: R,
    height: R,
    borderRadius: 13,
    backgroundColor: "#161619",
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // enclosed pill switch
  switch: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.panel,
    borderRadius: T.radiusPill,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: T.radiusPill,
  },
  tabOn: { backgroundColor: T.accent },
  tabText: { color: T.fgSoft, fontSize: 13.5, fontWeight: "700" },
  tabTextOn: { color: T.accentInk, fontWeight: "800" },
  more: {
    width: R,
    height: R,
    borderRadius: R / 2,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  pane: { ...StyleSheet.absoluteFillObject },
  hidden: { display: "none" },
});
