import { useState, useMemo, useCallback, memo } from "react";
import * as Clipboard from "expo-clipboard";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Switch, Modal, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { T } from "../lib/theme.js";

// The SHARED engine, driven by the Metro static catalog — the exact engine the web + CLI use, no re-port.
import { createEngine } from "engine/core/engine.js";
import { metroLoader } from "engine/core/metroLoader.js";
import { createPromptRun } from "engine/promptRun.js";
import baseSettings from "engine/settings.js";

const engine = createEngine(metroLoader);
const run = createPromptRun(engine);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const last = (k) => k.split("/").pop();

// The building-block palette, grouped from the engine's own catalog. Blocks insert as {#name}, lists as
// {name} — the web palette, adapted to a mobile drawer.
const PALETTE = (() => {
  const blocks = metroLoader.blockNames();
  const lists = metroLoader.listNames().filter((n) => !n.includes("-nsfw"));
  const byCat = {};
  for (const b of blocks) {
    const cat = b.includes("/") ? b.split("/")[0] : "block";
    (byCat[cat] ||= []).push({ token: `{#${last(b)}}`, label: last(b) });
  }
  const groups = [{ title: "Wildcards", items: [{ token: "{#random-words}", label: "random" }, { token: "{#any}", label: "any" }] }];
  for (const cat of Object.keys(byCat).sort()) groups.push({ title: cat, items: byCat[cat] });
  groups.push({ title: "lists", items: lists.map((n) => ({ token: `{${n}}`, label: last(n) })) });
  return groups;
})();

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

// One result row — memoized + stable identity so a single change re-renders one row, keeping the
// FlashList smooth as up to 1000 prompts roll out.
const ResultRow = memo(function ResultRow({ number, text, copied, onCopy }) {
  return (
    <View style={styles.result}>
      <View style={styles.resultHead}>
        <Text style={styles.resultNum}>#{number}</Text>
        <TouchableOpacity onPress={() => onCopy(text)} hitSlop={8}>
          <Text style={styles.copyLink}>{copied ? "Copied ✓" : "Copy"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.resultText} selectable>
        {text}
      </Text>
    </View>
  );
});

export default function GenerateScreen() {
  const [prompt, setPrompt] = useState(baseSettings.prompt || "{#random-words}");
  const [promptCount, setPromptCount] = useState(4);
  const [kwMin, setKwMin] = useState(baseSettings.keywordCount ?? 5);
  const [kwMax, setKwMax] = useState(baseSettings.keywordMaxCount ?? 7);
  const [includeArtist, setIncludeArtist] = useState(baseSettings.includeArtist ?? true);
  const [randomSeed, setRandomSeed] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const settings = useMemo(
    () => ({
      ...baseSettings,
      prompt,
      promptCount: clamp(promptCount, 1, 1000),
      keywordCount: Math.min(kwMin, kwMax),
      keywordMaxCount: Math.max(kwMin, kwMax),
      includeArtist,
      randomSeed,
      generateImages: false,
    }),
    [prompt, promptCount, kwMin, kwMax, includeArtist, randomSeed],
  );

  const generate = useCallback(() => {
    const { seed, prompts } = run.generatePrompts(settings);
    // Newest on top, stable id, matching the web (a roll adds to the list).
    setResults((prev) => [...prompts.map((text, i) => ({ id: `${seed}:${i}`, text })), ...prev]);
    setCopiedId(null);
  }, [settings]);

  const copy = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(text);
  }, []);

  const insert = useCallback((token) => {
    setPrompt((p) => (p.trim() ? `${p.trim()} ${token}` : token));
    setPaletteOpen(false);
  }, []);

  const header = (
    <View>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="{#random-words}"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <View style={styles.composerRow}>
          <TouchableOpacity style={styles.blocksBtn} onPress={() => setPaletteOpen(true)} activeOpacity={0.8}>
            <Text style={styles.blocksBtnText}>◧ Building blocks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.genBtn} onPress={generate} activeOpacity={0.85}>
            <Text style={styles.genBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.settingsToggle} onPress={() => setShowSettings((s) => !s)} hitSlop={6}>
          <Text style={styles.settingsToggleText}>{showSettings ? "▾ Settings" : "▸ Settings"}</Text>
        </TouchableOpacity>
        {showSettings && (
          <View style={styles.settingsBox}>
            <Row label="Prompts"><Stepper value={promptCount} setValue={setPromptCount} min={1} max={1000} /></Row>
            <Row label="Keywords (min)"><Stepper value={kwMin} setValue={setKwMin} min={0} max={20} /></Row>
            <Row label="Keywords (max)"><Stepper value={kwMax} setValue={setKwMax} min={0} max={20} /></Row>
            <Row label="Include artists">
              <Switch value={includeArtist} onValueChange={setIncludeArtist} trackColor={{ true: T.accentStrong, false: T.input }} thumbColor={includeArtist ? T.accent : T.faint} />
            </Row>
            <Row label="Random each time">
              <Switch value={randomSeed} onValueChange={setRandomSeed} trackColor={{ true: T.accentStrong, false: T.input }} thumbColor={randomSeed ? T.accent : T.faint} />
            </Row>
          </View>
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsHead}>
          <Text style={styles.resultsTitle}>Prompts</Text>
          <View style={styles.resultsHeadRight}>
            <Text style={styles.count}>{results.length} generated</Text>
            <TouchableOpacity onPress={() => setResults([])} hitSlop={8}>
              <Text style={styles.clearAll}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {results.length === 0 && (
        <Text style={styles.hint}>Compose a prompt and tap Generate to roll up to {promptCount}.</Text>
      )}
    </View>
  );

  return (
    <>
      <FlashList
        data={results}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listPad}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <ResultRow number={results.length - index} text={item.text} copied={copiedId === item.text} onCopy={copy} />
        )}
        estimatedItemSize={104}
      />

      {/* Building-block palette — an off-canvas drawer on the web; a bottom sheet here. */}
      <Modal visible={paletteOpen} animationType="slide" transparent onRequestClose={() => setPaletteOpen(false)}>
        <View style={styles.sheetScrim}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPaletteOpen(false)} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Building blocks</Text>
              <TouchableOpacity onPress={() => setPaletteOpen(false)} hitSlop={8}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {PALETTE.map((g) => (
                <View key={g.title} style={styles.paletteGroup}>
                  <Text style={styles.paletteCat}>{g.title}</Text>
                  <View style={styles.chips}>
                    {g.items.map((it) => (
                      <TouchableOpacity key={it.token} style={styles.chip} onPress={() => insert(it.token)}>
                        <Text style={styles.chipText}>{it.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  listPad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  card: { backgroundColor: T.panel, borderRadius: T.radius, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: T.borderSoft },
  input: { color: T.fg, fontSize: 15, backgroundColor: T.input, borderRadius: T.radiusSm, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 11, minHeight: 52, textAlignVertical: "top" },
  composerRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  blocksBtn: { flex: 1, backgroundColor: T.chip, borderRadius: T.radiusSm, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: T.border },
  blocksBtnText: { color: T.fgSoft, fontSize: 14, fontWeight: "700" },
  genBtn: { flex: 1, backgroundColor: T.accent, borderRadius: T.radiusSm, paddingVertical: 13, alignItems: "center" },
  genBtnText: { color: T.accentInk, fontSize: 15, fontWeight: "800" },
  settingsToggle: { marginTop: 12, alignSelf: "flex-start" },
  settingsToggleText: { color: T.muted, fontSize: 13, fontWeight: "700" },
  settingsBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: T.borderSoft, paddingTop: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { color: T.fgSoft, fontSize: 15 },
  rowControl: { flexDirection: "row", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: T.chip, alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: T.fgSoft, fontSize: 20, fontWeight: "700", lineHeight: 22 },
  stepValue: { color: T.fg, fontSize: 16, fontWeight: "700", minWidth: 34, textAlign: "center" },
  resultsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 2 },
  resultsTitle: { color: T.fg, fontSize: 17, fontWeight: "700" },
  resultsHeadRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  count: { color: T.muted, fontSize: 13 },
  clearAll: { color: T.dangerFg, fontSize: 13, fontWeight: "700" },
  hint: { color: T.faint, fontSize: 14, textAlign: "center", marginTop: 8 },
  result: { backgroundColor: T.panel, borderRadius: T.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.borderSoft },
  resultHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  resultNum: { color: T.faint, fontSize: 12, fontWeight: "700" },
  copyLink: { color: T.accent, fontSize: 13, fontWeight: "700" },
  resultText: { color: T.fgSoft, fontSize: 15, lineHeight: 22 },
  // palette sheet
  sheetScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: T.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "72%", borderTopWidth: 1, borderColor: T.border },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  sheetTitle: { color: T.fg, fontSize: 17, fontWeight: "700" },
  sheetClose: { color: T.muted, fontSize: 18, fontWeight: "700" },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 28 },
  paletteGroup: { marginBottom: 16 },
  paletteCat: { color: T.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: T.radiusPill, backgroundColor: T.chip, borderWidth: 1, borderColor: T.border },
  chipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },
});
