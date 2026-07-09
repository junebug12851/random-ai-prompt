import { useState, useMemo, useCallback, memo } from "react";
import * as Clipboard from "expo-clipboard";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Switch } from "react-native";
import { FlashList } from "@shopify/flash-list";

// The SHARED engine, driven by the Metro static catalog — the exact engine the web + CLI use, no re-port.
import { createEngine } from "engine/core/engine.js";
import { metroLoader } from "engine/core/metroLoader.js";
import { createPromptRun } from "engine/promptRun.js";
import baseSettings from "engine/settings.js";

const engine = createEngine(metroLoader);
const run = createPromptRun(engine);

const QUICK_PICKS = [
  { label: "Random", token: "{#random-words}" },
  { label: "Any", token: "{#any}" },
  { label: "Scene", token: "{#scene}" },
  { label: "Subject", token: "{#subject}" },
  { label: "Style", token: "{#style}" },
  { label: "Fragment", token: "{#fragment}" },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function Stepper({ value, setValue, min = 0, max = 99 }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => setValue(clamp(value - 1, min, max))} hitSlop={8}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => setValue(clamp(value + 1, min, max))} hitSlop={8}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, children }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

// One result row. Memoized + given stable identity across generations so a single change re-renders one
// row — the RN analog of the web's memoized PromptResult + content-visibility trick, so the FlashList
// stays smooth as 1000 rows roll out.
const ResultRow = memo(function ResultRow({ index, text, copied, onCopy }) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultText} selectable>
        {text}
      </Text>
      <TouchableOpacity style={styles.copyBtn} onPress={() => onCopy(text, index)} hitSlop={8}>
        <Text style={styles.copyBtnText}>{copied ? "Copied ✓" : "Copy"}</Text>
      </TouchableOpacity>
    </View>
  );
});

export default function GenerateScreen() {
  const [prompt, setPrompt] = useState(baseSettings.prompt || "{#random-words}");
  const [promptCount, setPromptCount] = useState(4);
  const [kwMin, setKwMin] = useState(baseSettings.keywordCount ?? 5);
  const [kwMax, setKwMax] = useState(baseSettings.keywordMaxCount ?? 7);
  const [includeArtist, setIncludeArtist] = useState(baseSettings.includeArtist ?? true);
  const [maxArtist, setMaxArtist] = useState(baseSettings.maxArtist ?? 2);
  const [randomSeed, setRandomSeed] = useState(true);
  const [results, setResults] = useState([]); // Array<{ id, text }>
  const [copied, setCopied] = useState(-1);

  const settings = useMemo(
    () => ({
      ...baseSettings,
      prompt,
      promptCount: clamp(promptCount, 1, 1000),
      keywordCount: Math.min(kwMin, kwMax),
      keywordMaxCount: Math.max(kwMin, kwMax),
      includeArtist,
      maxArtist,
      randomSeed,
      generateImages: false,
    }),
    [prompt, promptCount, kwMin, kwMax, includeArtist, maxArtist, randomSeed],
  );

  const generate = useCallback(() => {
    const { seed, prompts } = run.generatePrompts(settings);
    // Stable per-row identity (seed+index) so FlashList/React can keep unchanged rows referentially equal.
    setResults(prompts.map((text, i) => ({ id: `${seed}:${i}`, text })));
    setCopied(-1);
  }, [settings]);

  const copy = useCallback(async (text, i) => {
    await Clipboard.setStringAsync(text);
    setCopied(i);
  }, []);

  const header = (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Prompt</Text>
        <View style={styles.chips}>
          {QUICK_PICKS.map((q) => {
            const on = prompt === q.token;
            return (
              <TouchableOpacity key={q.token} style={[styles.chip, on && styles.chipOn]} onPress={() => setPrompt(q.token)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{q.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="{#random-words}"
          placeholderTextColor="#5a607a"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Settings</Text>
        <Row label="Prompts"><Stepper value={promptCount} setValue={setPromptCount} min={1} max={1000} /></Row>
        <Row label="Keywords (min)"><Stepper value={kwMin} setValue={setKwMin} min={0} max={20} /></Row>
        <Row label="Keywords (max)"><Stepper value={kwMax} setValue={setKwMax} min={0} max={20} /></Row>
        <Row label="Include artists">
          <Switch value={includeArtist} onValueChange={setIncludeArtist} trackColor={{ true: "#3a53a4", false: "#2a2d38" }} thumbColor={includeArtist ? "#5b8cff" : "#8a90a2"} />
        </Row>
        {includeArtist && <Row label="Max artists"><Stepper value={maxArtist} setValue={setMaxArtist} min={0} max={5} /></Row>}
        <Row label="Random each time">
          <Switch value={randomSeed} onValueChange={setRandomSeed} trackColor={{ true: "#3a53a4", false: "#2a2d38" }} thumbColor={randomSeed ? "#5b8cff" : "#8a90a2"} />
        </Row>
      </View>

      <TouchableOpacity style={styles.button} onPress={generate} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Generate</Text>
      </TouchableOpacity>

      {results.length === 0 && (
        <Text style={styles.hint}>Tap Generate to roll up to {promptCount} prompt{promptCount === 1 ? "" : "s"}.</Text>
      )}
    </View>
  );

  return (
    <FlashList
      data={results}
      keyExtractor={(it) => it.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listPad}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => (
        <ResultRow index={index} text={item.text} copied={copied === index} onCopy={copy} />
      )}
      estimatedItemSize={92}
    />
  );
}

const styles = StyleSheet.create({
  listPad: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  card: { backgroundColor: "#1a1c22", borderRadius: 14, padding: 14, marginBottom: 14 },
  cardLabel: { color: "#8a90a2", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#23262f", borderWidth: 1, borderColor: "#2e323d" },
  chipOn: { backgroundColor: "#2b3a63", borderColor: "#5b8cff" },
  chipText: { color: "#c3c8d6", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#dbe4ff" },
  input: { color: "#e8eaf0", fontSize: 15, backgroundColor: "#0e0f13", borderRadius: 10, borderWidth: 1, borderColor: "#2e323d", paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { color: "#e8eaf0", fontSize: 15 },
  rowControl: { flexDirection: "row", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#23262f", alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: "#dbe4ff", fontSize: 20, fontWeight: "700", lineHeight: 22 },
  stepValue: { color: "#fff", fontSize: 16, fontWeight: "700", minWidth: 34, textAlign: "center" },
  button: { backgroundColor: "#5b8cff", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  result: { backgroundColor: "#1a1c22", borderRadius: 12, padding: 14, marginBottom: 10 },
  resultText: { color: "#e8eaf0", fontSize: 15, lineHeight: 22 },
  copyBtn: { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#23262f" },
  copyBtnText: { color: "#9fb4ff", fontSize: 13, fontWeight: "700" },
  hint: { color: "#5a607a", fontSize: 14, textAlign: "center", marginTop: 4 },
});
