import { useState, useCallback } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { T } from "./lib/theme.js";
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

// Top-bar navigation mirroring the web SPA: brand + a condensed, horizontally-scrollable view switch
// (Generate / Gallery / Single / Manage). Panes stay MOUNTED (visibility toggled) so each keeps its
// state + scroll on tab switch — the same approach App.jsx uses on the web.
export default function App() {
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.logo} />
          <Text style={styles.wordmark}>Random AI Prompt</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.viewSwitch}
        >
          {TABS.map((t) => {
            const on = view === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.vsTab, on && styles.vsTabOn]}
                onPress={() => setView(t.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.vsTabText, on && styles.vsTabTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  topbar: {
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
    paddingTop: 4,
    paddingBottom: 6,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingVertical: 8 },
  logo: { width: 20, height: 20, borderRadius: 6, backgroundColor: T.accent },
  wordmark: { color: T.fg, fontSize: 18, fontWeight: "700", letterSpacing: 0.2 },
  viewSwitch: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingTop: 2 },
  vsTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radiusPill },
  vsTabOn: { backgroundColor: T.accentSoft },
  vsTabText: { color: T.muted, fontSize: 15, fontWeight: "600" },
  vsTabTextOn: { color: T.accent, fontWeight: "700" },
  body: { flex: 1 },
  pane: { ...StyleSheet.absoluteFillObject },
  hidden: { display: "none" },
});
