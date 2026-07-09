import { useState, useMemo, useCallback, memo } from "react";
import * as Clipboard from "expo-clipboard";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
const TOKEN = "#6b9bff";

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

// One circular toolbar icon button. `on` = active mint ring (the web's active tool); `disabled` = the
// muted, non-pressable look the web gives auto-fix / keyword-translate when no text provider is set
// (mobile has none). No hitSlop: 40px targets are big enough, and hitSlop made neighbors overlap.
function ToolBtn({ children, onPress, on, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.tool, on && styles.toolOn, disabled && styles.toolOff]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.6}
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
        <TouchableOpacity onPress={() => onCopy(text)}>
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [preview, setPreview] = useState(null); // one-shot expansion shown under the editor
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const lineCount = useMemo(() => Math.max(1, prompt.split("\n").length), [prompt]);
  const valid = useMemo(() => {
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
      randomSeed: true,
      generateImages: false,
    }),
    [prompt, promptCount],
  );

  const generate = useCallback(() => {
    const { seed, prompts } = run.generatePrompts(settings);
    setResults((prev) => [...prompts.map((text, i) => ({ id: `${seed}:${i}`, text })), ...prev]);
    setCopiedId(null);
    setPreview(null);
  }, [settings]);

  const doPreview = useCallback(() => {
    const { prompts } = run.generatePrompts({ ...settings, promptCount: 1 });
    setPreview(prompts[0] || "");
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
    setPrompt((p) => (p.trim() ? `${p.trim()}, ${token}` : token));
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

        {/* Code-editor-style prompt box: a plain monospace input (reliable — no overlay), with the DPL
            status ✓/✕ in the top-left corner and preview/settings in the top-right, like the web. */}
        <View style={styles.editor}>
          <View style={styles.editorHead}>
            {valid ? (
              <CheckIcon size={16} color={T.accentStrong} />
            ) : (
              <Text style={styles.badMark}>✕</Text>
            )}
            <View style={styles.editorHeadRight}>
              <TouchableOpacity onPress={doPreview} style={styles.headIcon}>
                <EyeIcon size={18} color={T.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGearOpen(true)} style={styles.headIcon}>
                <GearIcon size={18} color={T.muted} />
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

        {preview != null && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Preview</Text>
            <Text style={styles.previewText} selectable>
              {preview || "(empty)"}
            </Text>
          </View>
        )}

        {/* Field bar — the web composer footer. Left: editable Prompts-per-run count. Right: tools +
            round generate. Wraps on narrow widths (Prompts on top, tools below), like the web. */}
        <View style={styles.fieldBar}>
          <View style={styles.promptsCount}>
            <Text style={styles.promptsLabel}>PROMPTS</Text>
            <TouchableOpacity
              style={styles.countBtn}
              onPress={() => setPromptCount((n) => clamp(n - 1, 1, 1000))}
            >
              <Text style={styles.countBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.countVal}>{promptCount}</Text>
            <TouchableOpacity
              style={styles.countBtn}
              onPress={() => setPromptCount((n) => clamp(n + 1, 1, 1000))}
            >
              <Text style={styles.countBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolGroup}>
            <ToolBtn disabled>
              <WandIcon size={18} color={T.faint} />
            </ToolBtn>
            <ToolBtn disabled>
              <TagIcon size={18} color={T.faint} />
            </ToolBtn>
            <ToolBtn on onPress={() => setPaletteOpen(true)}>
              <BracketsIcon size={18} color={T.accent} />
            </ToolBtn>
            <ToolBtn onPress={copyAll}>
              <ShareIcon size={17} color={T.muted} />
            </ToolBtn>
            <ToolBtn onPress={generate}>
              <ShuffleIcon size={17} color={T.muted} />
            </ToolBtn>
            <TouchableOpacity style={styles.genRound} onPress={generate} activeOpacity={0.85}>
              <SparkleIcon size={22} color={T.accentInk} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {results.length > 0 && (
        <View style={styles.resultsHead}>
          <Text style={styles.resultsTitle}>Prompts</Text>
          <View style={styles.resultsHeadRight}>
            <Text style={styles.count}>{results.length} generated</Text>
            <TouchableOpacity onPress={() => setResults([])}>
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
              <TouchableOpacity onPress={() => setPaletteOpen(false)}>
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

      {/* Prompt settings — the web's gear popover. Minimal for now (Prompts per run); more to come. */}
      <Modal
        visible={gearOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGearOpen(false)}
      >
        <View style={styles.sheetScrim}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setGearOpen(false)}
            activeOpacity={1}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Prompt settings</Text>
              <TouchableOpacity onPress={() => setGearOpen(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.gearBody}>
              <View style={styles.gearRow}>
                <Text style={styles.gearLabel}>Prompts per run</Text>
                <View style={styles.promptsCount}>
                  <TouchableOpacity
                    style={styles.countBtn}
                    onPress={() => setPromptCount((n) => clamp(n - 1, 1, 1000))}
                  >
                    <Text style={styles.countBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.countVal}>{promptCount}</Text>
                  <TouchableOpacity
                    style={styles.countBtn}
                    onPress={() => setPromptCount((n) => clamp(n + 1, 1, 1000))}
                  >
                    <Text style={styles.countBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.gearNote}>More prompt settings are coming to mobile.</Text>
            </View>
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
  editorHeadRight: { flexDirection: "row", alignItems: "center" },
  headIcon: { paddingHorizontal: 8, paddingVertical: 2 },
  badMark: { color: T.dangerFg, fontSize: 16, fontWeight: "800" },

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
  codeInput: {
    flex: 1,
    color: T.fg,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: "monospace",
    padding: 0,
    minHeight: CODE_LH * 3,
    textAlignVertical: "top",
  },

  previewBox: {
    marginTop: 12,
    backgroundColor: T.panel,
    borderRadius: T.radiusSm,
    borderWidth: 1,
    borderColor: T.borderSoft,
    padding: 12,
  },
  previewLabel: {
    color: T.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  previewText: { color: T.fgSoft, fontSize: 14, lineHeight: 21 },

  fieldBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 12,
    marginTop: 14,
  },
  promptsCount: { flexDirection: "row", alignItems: "center", gap: 8 },
  promptsLabel: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginRight: 2,
  },
  countBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: T.chip,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
  },
  countBtnText: { color: T.fgSoft, fontSize: 18, fontWeight: "700", lineHeight: 20 },
  countVal: { color: T.fg, fontSize: 16, fontWeight: "800", minWidth: 26, textAlign: "center" },

  toolGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  toolOff: { opacity: 0.45 },
  genRound: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

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

  // sheets (palette + gear)
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
  sheetClose: { color: T.muted, fontSize: 18, fontWeight: "700", paddingHorizontal: 6 },
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
  gearBody: { paddingHorizontal: 18, paddingBottom: 28, paddingTop: 4 },
  gearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  gearLabel: { color: T.fgSoft, fontSize: 15 },
  gearNote: { color: T.faint, fontSize: 13, marginTop: 8 },
});
