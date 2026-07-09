import { useState, useCallback } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import GenerateScreen from "./screens/GenerateScreen.js";
import GalleryScreen from "./screens/GalleryScreen.js";
import SingleScreen from "./screens/SingleScreen.js";
import ManageScreen from "./screens/ManageScreen.js";

const TABS = [
  { id: "generate", label: "Generate", icon: "✦" },
  { id: "gallery", label: "Gallery", icon: "▦" },
  { id: "single", label: "Single", icon: "◉" },
  { id: "manage", label: "Manage", icon: "☰" },
];

// All panes stay MOUNTED (visibility toggled) so each keeps its state + scroll when you switch tabs —
// the same approach the web SPA uses. `display:none` on RN removes a view from layout without unmounting.
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
      <View style={styles.header}>
        <Text style={styles.title}>Random AI Prompt</Text>
        <Text style={styles.tag}>{TABS.find((t) => t.id === view)?.label}</Text>
      </View>

      <View style={styles.body}>
        <View style={pane("generate")}>
          <GenerateScreen />
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

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const on = view === t.id;
          return (
            <TouchableOpacity key={t.id} style={styles.tab} onPress={() => setView(t.id)} activeOpacity={0.7}>
              <Text style={[styles.tabIcon, on && styles.tabOn]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, on && styles.tabOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f13" },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  tag: { color: "#5b8cff", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { flex: 1 },
  pane: { ...StyleSheet.absoluteFillObject },
  hidden: { display: "none" },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#1e2027",
    backgroundColor: "#121317",
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { color: "#6b7185", fontSize: 18 },
  tabLabel: { color: "#6b7185", fontSize: 11, fontWeight: "600" },
  tabOn: { color: "#5b8cff" },
});
