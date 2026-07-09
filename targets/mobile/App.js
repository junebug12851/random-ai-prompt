import { useState, useMemo, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

// The SHARED engine, driven by the Metro static catalog — the exact engine the web + CLI use, no re-port.
import { createEngine } from "./engine/core/engine.js";
import { metroLoader } from "./engine/core/metroLoader.js";
import { createPromptRun } from "./engine/promptRun.js";
import baseSettings from "./engine/settings.js";

const engine = createEngine(metroLoader);
const run = createPromptRun(engine);

export default function App() {
  const settings = useMemo(() => ({ ...baseSettings, generateImages: false }), []);
  const [prompt, setPrompt] = useState(() => run.generatePrompt(settings));
  const reroll = useCallback(() => setPrompt(run.generatePrompt(settings)), [settings]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Random AI Prompt</Text>
      <Text style={styles.subtitle}>engine + metroLoader running on React Native</Text>
      <ScrollView style={styles.promptBox} contentContainerStyle={styles.promptContent}>
        <Text style={styles.prompt}>{prompt}</Text>
      </ScrollView>
      <TouchableOpacity style={styles.button} onPress={reroll} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Reroll</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f13", paddingHorizontal: 20, paddingTop: 24 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#8a90a2", fontSize: 13, marginTop: 4, marginBottom: 16 },
  promptBox: { flex: 1, backgroundColor: "#1a1c22", borderRadius: 14, padding: 16 },
  promptContent: { paddingBottom: 8 },
  prompt: { color: "#e8eaf0", fontSize: 16, lineHeight: 24 },
  button: {
    backgroundColor: "#5b8cff",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginVertical: 20,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});