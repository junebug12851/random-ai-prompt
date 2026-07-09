import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { T } from "../lib/theme.js";
import {
  CheckIcon,
  EyeIcon,
  GearIcon,
  WandIcon,
  TagIcon,
  BracketsIcon,
  ShareIcon,
  ShuffleIcon,
  SparkleIcon,
  GridIcon,
} from "../lib/icons.js";
import { run, baseSettings, expandOnce } from "../lib/engine.js";
import { getDplCompletions } from "../lib/blockCatalog.js";
import InsertMenu from "../components/InsertMenu.js";
import BlockPalette from "../components/BlockPalette.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const COMPLETIONS = getDplCompletions();

// The token being typed at the caret: the last unclosed "{…" run with no whitespace. Drives the
// completion strip (the mobile form of the web editor's autocomplete dropdown).
function activeToken(text, caret) {
  const upto = text.slice(0, caret);
  const open = upto.lastIndexOf("{");
  if (open < 0) return null;
  if (upto.indexOf("}", open) !== -1) return null; // already closed before the caret
  const frag = upto.slice(open);
  if (/\s/.test(frag)) return null;
  return { start: open, frag };
}

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
  const [previewOn, setPreviewOn] = useState(false);
  const [preview, setPreview] = useState("");
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [focused, setFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const caret = useRef(prompt.length);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

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

  // Completion candidates for the token at the caret.
  const [caretTick, setCaretTick] = useState(0); // bump to recompute suggestions on caret move
  const suggestions = useMemo(() => {
    if (!focused) return [];
    const at = activeToken(prompt, caret.current);
    if (!at) return [];
    const f = at.frag.toLowerCase();
    if (f === "{" || f === "{#") return COMPLETIONS.slice(0, 24); // just opened — show a starter set
    return COMPLETIONS.filter(
      (c) =>
        c.token.toLowerCase().startsWith(f) ||
        c.label.toLowerCase().includes(f.replace(/^\{#?/, "")),
    ).slice(0, 24);
  }, [prompt, focused, caretTick]);

  const applyCompletion = useCallback((token) => {
    const text = promptRef.current;
    const at = activeToken(text, caret.current);
    const start = at ? at.start : text.length;
    const end = at ? caret.current : text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setPrompt(next);
    caret.current = start + token.length;
  }, []);

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
  }, [settings]);

  // Live preview: while toggled on, re-roll the current prompt every second (like the web eye).
  useEffect(() => {
    if (!previewOn) {
      setPreview("");
      return undefined;
    }
    const roll = () => setPreview(expandOnce(promptRef.current || "{#random-words}"));
    roll();
    const id = setInterval(roll, 1000);
    return () => clearInterval(id);
  }, [previewOn]);

  const copy = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(text);
  }, []);
  const copyAll = useCallback(async () => {
    if (!results.length) return;
    await Clipboard.setStringAsync(results.map((r) => r.text).join("\n"));
    setCopiedId("__all__");
  }, [results]);

  const insertToken = useCallback((token) => {
    setPrompt((p) => (p.trim() ? `${p.trim()}, ${token}` : token));
    setPaletteOpen(false);
  }, []);
  // Insert a DPL snippet from the Insert menu at the end (line constructs onto a fresh line).
  const insertSnippet = useCallback((text) => {
    setPrompt((p) => {
      if (!p.trim()) return text;
      return /\n\s*$/.test(p) || p.endsWith("\n") ? p + text : `${p}\n${text}`;
    });
  }, []);

  const header = (
    <View>
      <View style={styles.card}>
        <InsertMenu onInsert={insertSnippet} />

        <View style={[styles.editor, focused && styles.editorFocus]}>
          <View style={styles.editorHead}>
            {valid ? (
              <CheckIcon size={16} color={T.accentStrong} />
            ) : (
              <Text style={styles.badMark}>✕</Text>
            )}
            <View style={styles.editorHeadRight}>
              <TouchableOpacity onPress={() => setPreviewOn((v) => !v)} style={styles.headIcon}>
                <EyeIcon size={18} color={previewOn ? T.accent : T.muted} />
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
                  {i === 0 && (
                    <TouchableOpacity
                      onPress={() => setPrompt((p) => (p.endsWith("\n") || !p ? p : p + "\n"))}
                      hitSlop={10}
                    >
                      <Text style={styles.gutterPlus}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            <TextInput
              style={styles.codeInput}
              value={prompt}
              onChangeText={(t) => {
                setPrompt(t);
                setCaretTick((n) => n + 1);
              }}
              onSelectionChange={(e) => {
                caret.current = e.nativeEvent.selection.end;
                setCaretTick((n) => n + 1);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="{#random-words}"
              placeholderTextColor={T.faint}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              spellCheck={false}
            />
          </View>
        </View>

        {/* DPL completion strip — the mobile form of the web editor's autocomplete dropdown. */}
        {suggestions.length > 0 && (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggStripPad}
          >
            <View style={styles.suggStripRow}>
              {suggestions.map((c) => (
                <TouchableOpacity
                  key={c.token}
                  style={styles.sugg}
                  onPress={() => applyCompletion(c.token)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggLabel}>{c.label}</Text>
                  <Text style={styles.suggKind}>{c.kind === "gen" ? "block" : "list"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {previewOn && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>PREVIEW · LIVE</Text>
            <Text style={styles.previewText} selectable>
              {preview || "…"}
            </Text>
          </View>
        )}

        <View style={styles.fieldBar}>
          {/* Left cluster: the Prompts-per-run count + the tool icons (left-aligned, wraps on narrow
              widths). The generate button is separate, pinned to the right. */}
          <View style={styles.leftCluster}>
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
            </View>
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

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setPaletteOpen(true)}
        activeOpacity={0.85}
      >
        <GridIcon size={24} color={T.accentInk} />
      </TouchableOpacity>

      <BlockPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onInsert={insertToken}
      />

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
          <View style={styles.gearSheet}>
            <View style={styles.gearHead}>
              <Text style={styles.gearTitle}>Prompt settings</Text>
              <TouchableOpacity onPress={() => setGearOpen(false)}>
                <Text style={styles.gearClose}>✕</Text>
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

  editor: {
    marginTop: 12,
    backgroundColor: T.input,
    borderRadius: T.radiusSm,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  editorFocus: { borderColor: T.accent },
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

  suggStripPad: { paddingTop: 10, paddingBottom: 2 },
  suggStripRow: { flexDirection: "row", gap: 8 },
  sugg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: T.radiusPill,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.border,
  },
  suggLabel: { color: T.fg, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  suggKind: { color: T.faint, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },

  previewBox: {
    marginTop: 12,
    backgroundColor: T.panel,
    borderRadius: T.radiusSm,
    borderWidth: 1,
    borderColor: T.accent,
    padding: 12,
  },
  previewLabel: {
    color: T.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  previewText: { color: T.fgSoft, fontSize: 14, lineHeight: 21 },

  fieldBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
  },
  leftCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    rowGap: 12,
    flexShrink: 1,
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

  sheetScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  gearSheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: T.border,
  },
  gearHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  gearTitle: { color: T.fg, fontSize: 17, fontWeight: "700" },
  gearClose: { color: T.muted, fontSize: 18, fontWeight: "700", paddingHorizontal: 6 },
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
