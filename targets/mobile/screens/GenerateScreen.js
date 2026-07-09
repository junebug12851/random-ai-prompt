import { useState, useMemo, useCallback, memo } from "react";
import * as Clipboard from "expo-clipboard";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  Modal,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { T } from "../lib/theme.js";
import {
  CheckIcon,
  EyeIcon,
  GearIcon,
  ChevronDownIcon,
  WandIcon,
  TagIcon,
  BracketsIcon,
  ShareIcon,
  ShuffleIcon,
  SparkleIcon,
  GridIcon,
} from "../lib/icons.js";

// The SHARED engine, driven by the Metro static catalog — the exact engine the web + CLI use, no re-port.
import { createEngine } from "engine/core/engine.js";
import { metroLoader } from "engine/core/metroLoader.js";
import { createPromptRun } from "engine/promptRun.js";
import baseSettings from "engine/settings.js";

const engine = createEngine(metroLoader);
const run = createPromptRun(engine);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const last = (k) => k.split("/").pop();
const TOKEN = "#6b9bff"; // {…} token color, matching the web editor's blue

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
  const groups = [
    {
      title: "Wildcards",
      items: [
        { token: "{#random-words}", label: "random" },
        { token: "{#any}", label: "any" },
      ],
    },
  ];
  for (const cat of Object.keys(byCat).sort()) groups.push({ title: cat, items: byCat[cat] });
  groups.push({ title: "lists", items: lists.map((n) => ({ token: `{${n}}`, label: last(n) })) });
  return groups;
})();

// Tokenize a prompt into colored runs for the highlight layer: {…} spans blue, everything else default.
function highlight(text) {
  const parts = [];
  const re = /\{[^}]*\}/g;
  let i = 0,
    m,
    key = 0;
  while ((m = re.exec(text))) {
    if (m.index > i)
      parts.push(
        <Text key={key++} style={styles.codePlain}>
          {text.slice(i, m.index)}
        </Text>,
      );
    parts.push(
      <Text key={key++} style={styles.codeToken}>
        {m[0]}
      </Text>,
    );
    i = m.index + m[0].length;
  }
  if (i < text.length)
    parts.push(
      <Text key={key++} style={styles.codePlain}>
        {text.slice(i)}
      </Text>,
    );
  if (parts.length === 0)
    parts.push(
      <Text key={key++} style={styles.codePlain}>
        {" "}
      </Text>,
    );
  return parts;
}

function Stepper({ value, setValue, min = 0, max = 99 }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => setValue(clamp(value - 1, min, max))}
        hitSlop={8}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => setValue(clamp(value + 1, min, max))}
        hitSlop={8}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingRow({ label, children }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>{label}</Text>
      <View style={styles.setControl}>{children}</View>
    </View>
  );
}

// One circular toolbar icon button. `on` gives it the active mint ring, like the web's active tool.
function ToolBtn({ children, onPress, on }) {
  return (
    <TouchableOpacity
      style={[styles.tool, on && styles.toolOn]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={6}
    >
      {children}
    </TouchableOpacity>
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
  const [promptCount, setPromptCount] = useState(1);
  const [kwMin, setKwMin] = useState(baseSettings.keywordCount ?? 5);
  const [kwMax, setKwMax] = useState(baseSettings.keywordMaxCount ?? 7);
  const [includeArtist, setIncludeArtist] = useState(baseSettings.includeArtist ?? true);
  const [randomSeed, setRandomSeed] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const lineCount = useMemo(() => Math.max(1, prompt.split("\n").length), [prompt]);
  const valid = useMemo(() => {
    // Balanced braces = "valid" indicator, like the web's ✓/✗.
    let depth = 0;
    for (const ch of prompt) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }, [prompt]);

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
    setResults((prev) => [...prompts.map((text, i) => ({ id: `${seed}:${i}`, text })), ...prev]);
    setCopiedId(null);
  }, [settings]);

  const copy = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(text);
  }, []);
  const copyAll = useCallback(async () => {
    if (!results.length) return;
    await Clipboard.setStringAsync(results.map((r) => r.text).join("\n"));
    setCopiedId("__all__");
  }, [results]);

  const insert = useCallback((token) => {
    setPrompt((p) => (p.trim() ? `${p.trim()} ${token}` : token));
    setPaletteOpen(false);
  }, []);

  const header = (
    <View>
      {/* Composer card — the web PromptComposer, natively. */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.insert}
          onPress={() => setPaletteOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.insertText}>Insert</Text>
          <ChevronDownIcon size={15} color={T.fgSoft} />
        </TouchableOpacity>

        {/* Code-editor-style prompt box: highlight layer + transparent editable input overlaid. */}
        <View style={styles.editor}>
          <View style={styles.editorHead}>
            <CheckIcon size={16} color={valid ? T.accentStrong : T.dangerFg} />
            <View style={styles.editorHeadRight}>
              <TouchableOpacity hitSlop={8} onPress={() => generate()}>
                <EyeIcon size={18} color={T.muted} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} onPress={() => setShowSettings((s) => !s)}>
                <GearIcon size={18} color={showSettings ? T.accent : T.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.codeRow}>
            <View style={styles.gutter}>
              {Array.from({ length: lineCount }, (_, i) => (
                <View key={i} style={styles.gutterLine}>
                  <Text style={styles.gutterNum}>{i + 1}</Text>
                  {i === 0 && <Text style={styles.gutterPlus}>+</Text>}
                </View>
              ))}
            </View>
            <View style={styles.codeCol}>
              <Text style={styles.codeLayer} pointerEvents="none">
                {highlight(prompt)}
              </Text>
              <TextInput
                style={styles.codeInput}
                value={prompt}
                onChangeText={setPrompt}
                placeholder="{#random-words}"
                placeholderTextColor={T.faint}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                spellCheck={false}
              />
            </View>
          </View>
        </View>

        {showSettings && (
          <View style={styles.settingsBox}>
            <SettingRow label="Prompts">
              <Stepper value={promptCount} setValue={setPromptCount} min={1} max={1000} />
            </SettingRow>
            <SettingRow label="Keywords (min)">
              <Stepper value={kwMin} setValue={setKwMin} min={0} max={20} />
            </SettingRow>
            <SettingRow label="Keywords (max)">
              <Stepper value={kwMax} setValue={setKwMax} min={0} max={20} />
            </SettingRow>
            <SettingRow label="Include artists">
              <Switch
                value={includeArtist}
                onValueChange={setIncludeArtist}
                trackColor={{ true: T.accentStrong, false: T.input }}
                thumbColor={includeArtist ? T.accent : T.faint}
              />
            </SettingRow>
            <SettingRow label="Random each time">
              <Switch
                value={randomSeed}
                onValueChange={setRandomSeed}
                trackColor={{ true: T.accentStrong, false: T.input }}
                thumbColor={randomSeed ? T.accent : T.faint}
              />
            </SettingRow>
          </View>
        )}

        <Text style={styles.promptsCount}>
          PROMPTS <Text style={styles.promptsNum}>{promptCount}</Text>
        </Text>

        {/* Tool toolbar + round generate button — the web composer footer. */}
        <View style={styles.toolbar}>
          <View style={styles.toolGroup}>
            <ToolBtn onPress={() => setShowSettings((s) => !s)}>
              <WandIcon size={18} color={T.muted} />
            </ToolBtn>
            <ToolBtn onPress={() => setPaletteOpen(true)}>
              <TagIcon size={18} color={T.muted} />
            </ToolBtn>
            <ToolBtn on onPress={() => setPaletteOpen(true)}>
              <BracketsIcon size={18} color={T.accent} />
            </ToolBtn>
            <ToolBtn onPress={copyAll}>
              <ShareIcon size={17} color={T.muted} />
            </ToolBtn>
            <ToolBtn
              onPress={() => {
                setRandomSeed(true);
                generate();
              }}
            >
              <ShuffleIcon size={17} color={T.muted} />
            </ToolBtn>
          </View>
          <TouchableOpacity style={styles.genRound} onPress={generate} activeOpacity={0.85}>
            <SparkleIcon size={22} color={T.accentInk} />
          </TouchableOpacity>
        </View>
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
          <ResultRow
            number={results.length - index}
            text={item.text}
            copied={copiedId === item.text}
            onCopy={copy}
          />
        )}
        estimatedItemSize={104}
      />

      {/* Building-blocks palette FAB — the web's bottom-left green button. */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setPaletteOpen(true)}
        activeOpacity={0.85}
      >
        <GridIcon size={24} color={T.accentInk} />
      </TouchableOpacity>

      {/* Building-block palette — an off-canvas drawer on the web; a bottom sheet here. */}
      <Modal
        visible={paletteOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPaletteOpen(false)}
      >
        <View style={styles.sheetScrim}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setPaletteOpen(false)}
            activeOpacity={1}
          />
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
                      <TouchableOpacity
                        key={it.token}
                        style={styles.chip}
                        onPress={() => insert(it.token)}
                      >
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

const CODE_FONT = 14.5;
const CODE_LH = 22;

const styles = StyleSheet.create({
  listPad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  card: {
    backgroundColor: T.elevated,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: T.borderSoft,
  },

  insert: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: T.radiusPill,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.panel,
    marginBottom: 12,
  },
  insertText: { color: T.fgSoft, fontSize: 14, fontWeight: "700" },

  editor: {
    backgroundColor: T.input,
    borderRadius: T.radiusSm,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  editorHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  editorHeadRight: { flexDirection: "row", alignItems: "center", gap: 16 },

  codeRow: { flexDirection: "row" },
  gutter: {
    paddingRight: 12,
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: T.borderSoft,
  },
  gutterLine: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  gutterNum: { color: T.faint, fontSize: CODE_FONT, lineHeight: CODE_LH, fontFamily: "monospace" },
  gutterPlus: { color: T.muted, fontSize: CODE_FONT, lineHeight: CODE_LH, fontWeight: "700" },
  codeCol: { flex: 1, minHeight: CODE_LH * 3 },
  codeLayer: { fontSize: CODE_FONT, lineHeight: CODE_LH, fontFamily: "monospace" },
  codePlain: { color: T.fg, fontSize: CODE_FONT, lineHeight: CODE_LH, fontFamily: "monospace" },
  codeToken: {
    color: TOKEN,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  codeInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: "monospace",
    padding: 0,
    textAlignVertical: "top",
  },

  promptsCount: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 14,
  },
  promptsNum: { color: T.fg, fontSize: 13, fontWeight: "800" },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  toolGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  tool: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toolOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
  genRound: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  settingsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: T.borderSoft, paddingTop: 6 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  setLabel: { color: T.fgSoft, fontSize: 15 },
  setControl: { flexDirection: "row", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: T.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: T.fgSoft, fontSize: 20, fontWeight: "700", lineHeight: 22 },
  stepValue: { color: T.fg, fontSize: 16, fontWeight: "700", minWidth: 34, textAlign: "center" },

  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2,
  },
  resultsTitle: { color: T.fg, fontSize: 17, fontWeight: "700" },
  resultsHeadRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  count: { color: T.muted, fontSize: 13 },
  clearAll: { color: T.dangerFg, fontSize: 13, fontWeight: "700" },
  result: {
    backgroundColor: T.panel,
    borderRadius: T.radius,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.borderSoft,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resultNum: { color: T.faint, fontSize: 12, fontWeight: "700" },
  copyLink: { color: T.accent, fontSize: 13, fontWeight: "700" },
  resultText: { color: T.fgSoft, fontSize: 15, lineHeight: 22 },

  fab: {
    position: "absolute",
    left: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // palette sheet
  sheetScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "72%",
    borderTopWidth: 1,
    borderColor: T.border,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sheetTitle: { color: T.fg, fontSize: 17, fontWeight: "700" },
  sheetClose: { color: T.muted, fontSize: 18, fontWeight: "700" },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 28 },
  paletteGroup: { marginBottom: 16 },
  paletteCat: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: T.radiusPill,
    backgroundColor: T.chip,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },
});
