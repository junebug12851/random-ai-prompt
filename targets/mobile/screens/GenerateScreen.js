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
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useTheme } from "../lib/theme.js";
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
import { run, baseSettings, expandOnce, getListNames } from "../lib/engine.js";
import { getDplCompletions } from "../lib/blockCatalog.js";
import { getImageProvider, getTextProvider, providerDefaults, systemFor } from "../lib/imageProviders.js";
import { sizeFromSettings } from "../lib/single.js";
import { getKey } from "../lib/keys.js";
import { saveImageSrc } from "../lib/storage.js";
import InsertMenu from "../components/InsertMenu.js";
import BlockPalette from "../components/BlockPalette.js";

const LIST_OPTIONS = [
  { value: false, label: "(fully random)" },
  ...getListNames().map((n) => ({ value: n, label: n })),
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Prompts-per-roll has a FLOOR (you can't roll zero prompts) but deliberately NO CEILING. The
// documented 1000 is the level the app supports with *no performance loss* — a promise about
// behaviour, not a cap on the user. Nothing in this app tells a user "no": if it handles 1000
// smoothly it will handle more, degrading gracefully rather than refusing. (This screen used to
// clamp to 1000 in five places — a mobile-only limit the engine and the web never had.)
const atLeast1 = (n) => Math.max(1, n);
const COMPLETIONS = getDplCompletions();

// Share link — encode settings (minus secrets) into the web app's #s= hash so a setup can be
// restored elsewhere (mirrors targets/web/frontend/lib/share.js).
const SHARE_BASE = "https://prompt.fairyfox.io/";
const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes (web parity)
function b64url(str) {
  // btoa over a UTF-8-safe byte string, then URL-safe.
  const utf8 = unescape(encodeURIComponent(str));
  const b64 = typeof btoa === "function" ? btoa(utf8) : Buffer.from(utf8, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function shareUrl(settings) {
  const { keys, ...shareable } = settings || {};
  return `${SHARE_BASE}#s=${b64url(JSON.stringify(shareable))}`;
}

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

function ToolBtn({ children, onPress, on, disabled, accessibilityLabel }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <TouchableOpacity
      style={[styles.tool, on && styles.toolOn, disabled && styles.toolOff]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.6}
      // A locked control must ANNOUNCE that it's locked (and be assertable in tests) — not just
      // look faded. See notes/reference/working-agreements.md §E.
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: !!on }}
    >
      {children}
    </TouchableOpacity>
  );
}

const ResultRow = memo(function ResultRow({
  number,
  text,
  images,
  copied,
  onCopy,
  canImages,
  busy,
  onGenImages,
  onOpenImage,
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={styles.result}>
      <View style={styles.resultHead}>
        <Text style={styles.resultNum}>#{number}</Text>
        <View style={styles.resultHeadRight}>
          {canImages && (
            <TouchableOpacity accessibilityRole="button" onPress={() => onGenImages(text)} disabled={busy}>
              <Text style={[styles.copyLink, busy && { opacity: 0.5 }]}>
                {busy ? "Generating…" : "Generate images"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity accessibilityRole="button" onPress={() => onCopy(text)}>
            <Text style={styles.copyLink}>{copied ? "Copied ✓" : "Copy"}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.resultText} selectable>
        {text}
      </Text>
      {images && images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.resultThumbs}
        >
          {/* Each thumb is the SAVED gallery item ({name, uri}) — tapping opens it in the Single view
              (the web's inline image batch behaviour). Raw provider sources are never stored here. */}
          {images.map((img, i) => (
            <TouchableOpacity
              key={img.uri ?? i}
              onPress={() => onOpenImage?.(img)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Open generated image ${i + 1}`}
            >
              <Image
                source={{ uri: img.uri }}
                style={styles.resultThumb}
                contentFit="cover"
                transition={120}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

export default function GenerateScreen({ onGenerated, onOpenImage }) {
  const { T, provider, rewriteProvider, providerSettings, setProviderSetting, backendUrl } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [prompt, setPrompt] = useState(baseSettings.prompt || "{#random-words}");
  const [promptCount, setPromptCount] = useState(1);
  const [composeMode, setComposeMode] = useState("prompt"); // "prompt" | "negative"
  const [wrapperOpen, setWrapperOpen] = useState(false);

  // The active image provider + its negative-prompt capability. The negative lives in
  // providerSettings[id].negativePrompt (the same field the adapters read).
  const imgProv = getImageProvider(provider);
  const supportsNegative = !!imgProv?.negative;
  const editMode = supportsNegative ? composeMode : "prompt";
  const negative = providerSettings[provider]?.negativePrompt ?? "";
  const setNegative = (v) =>
    setProviderSetting(provider, "negativePrompt", typeof v === "function" ? v(negative) : v);
  const [cfg, setCfg] = useState({}); // gear overrides on top of baseSettings (seed, vocab, emphasis, …)
  const [autoFix, setAutoFix] = useState(false); // wand — rewrite prompt with the Text provider
  const [autoKeyword, setAutoKeyword] = useState(false); // tag — keyword-translate with the Text provider
  const canRewrite = !!rewriteProvider && rewriteProvider !== "none";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [previewOn, setPreviewOn] = useState(false);
  const [preview, setPreview] = useState("");
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [rowBusy, setRowBusy] = useState(null); // id of the result row currently generating images
  const [focused, setFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const caret = useRef(prompt.length);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  // Monotonic per-click batch counter so result-row ids are unique even when a fixed promptSeed reuses
  // the same seed across generations (otherwise `${seed}:${i}` ids collide and image updates misattribute).
  const batchSeq = useRef(0);

  // The editor edits the prompt or (when the provider supports it and the Negative tab is active)
  // the negative prompt.
  const activeValue = editMode === "negative" ? negative : prompt;
  const setActiveValue = editMode === "negative" ? setNegative : setPrompt;

  const lineCount = useMemo(() => Math.max(1, activeValue.split("\n").length), [activeValue]);
  const valid = useMemo(() => {
    let depth = 0;
    for (const ch of activeValue) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }, [activeValue]);


  // Completion candidates for the token at the caret.
  const [caretTick, setCaretTick] = useState(0); // bump to recompute suggestions on caret move
  const suggestions = useMemo(() => {
    if (!focused || editMode === "negative") return [];
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
      ...cfg,
      prompt,
      promptCount: atLeast1(promptCount),
      generateImages: false,
    }),
    [prompt, promptCount, cfg],
  );
  const getS = (k) => (cfg[k] !== undefined ? cfg[k] : baseSettings[k]);
  const setS = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  // A rotating random prompt SUGGESTION — web parity (PromptComposer): the empty box shows "Try: …"
  // and the shuffle button drops the suggestion in. Distinct from the DPL *completion* candidates
  // (caret autocomplete) — the two used to share the name "suggestions", which is exactly how the
  // surface-parity check falsely passed while this feature was missing from mobile entirely.
  //
  // MUST sit below `settings` (it reads it): declared above, this threw a temporal-dead-zone
  // ReferenceError that blanked the whole app — and every unit test still passed, because they mock
  // the engine and never exercise the real module order. Only the screenshot caught it.
  // See notes/reference/fix-patterns.md.
  const [suggestion, setSuggestion] = useState("");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const roll = () => {
      try {
        setSuggestion(expandOnce("{#random-words}", settingsRef.current));
      } catch {
        /* engine not ready — skip this tick */
      }
    };
    roll();
    const id = setInterval(roll, SUGGESTION_MS);
    return () => clearInterval(id);
  }, []);

  /** Drop the current random suggestion into the active box (append, like the web's insert). */
  const useSuggestion = useCallback(() => {
    if (!suggestion) return;
    setActiveValue((current = "") => {
      const sep = current && !/\s$/.test(current) ? ", " : "";
      return `${current}${sep}${suggestion}`;
    });
  }, [suggestion, setActiveValue]);

  // Inline image controls (Images count + Size/Ratio) surfaced next to the Prompts counter — they
  // read/write the SAME providerSettings[id] fields the ⋯ menu edits, so the two stay in lockstep.
  const imgProvSettings = imgProv?.settings || [];
  const imgBatchField = imgProvSettings.find((f) => f.key === "batchSize");
  const imgSizeField = imgProvSettings.find((f) => ["size", "imageSize", "aspectRatio"].includes(f.key));
  const imgGet = (k, d) =>
    providerSettings[provider]?.[k] ?? providerDefaults(provider)[k] ?? d;
  const setImgParam = (k, v) => setProviderSetting(provider, k, v);

  // Gear field rows (plain functions returning JSX so TextInputs keep focus between keystrokes).
  const grp = (title, children) => (
    <View style={styles.grp} key={title}>
      <Text style={styles.grpTitle}>{title}</Text>
      {children}
    </View>
  );
  const toggleRow = (label, key, defaultOn) => (
    <View style={styles.setRow} key={key}>
      <Text style={styles.setRowLabel}>{label}</Text>
      <Switch
        value={defaultOn ? getS(key) !== false : !!getS(key)}
        onValueChange={(v) => setS(key, v)}
        trackColor={{ true: T.accent, false: T.border }}
        thumbColor="#fff"
      />
    </View>
  );
  const numRow = (label, key) => (
    <View style={styles.setRow} key={key}>
      <Text style={styles.setRowLabel}>{label}</Text>
      <TextInput
        style={styles.setNum}
        keyboardType="numbers-and-punctuation"
        value={String(getS(key) ?? "")}
        onChangeText={(v) => setS(key, v === "" || v === "-" ? v : Number(v))}
        placeholderTextColor={T.faint}
      />
    </View>
  );
  const textRow = (label, key, readOnly) => (
    <View style={styles.setRow} key={key}>
      <Text style={styles.setRowLabel}>{label}</Text>
      <TextInput
        style={[styles.setTextInput, readOnly && { opacity: 0.5 }]}
        editable={!readOnly}
        value={String(getS(key) ?? "")}
        onChangeText={(v) => setS(key, v)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={T.faint}
      />
    </View>
  );
  const selectRow = (label, key, options) => (
    <View style={styles.setSelBlock} key={key}>
      <Text style={styles.setRowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.setChips}
      >
        {options.map((o) => {
          const on = getS(key) === o.value;
          return (
            <TouchableOpacity accessibilityRole="button"
              key={String(o.value)}
              style={[styles.setChip, on && styles.setChipOn]}
              onPress={() => setS(key, o.value)}
            >
              <Text style={[styles.setChipText, on && styles.setChipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // The active wrapper (a { start, end } DPL pair) frames every rolled prompt — mirrors the web's
  // buildRoll: render each part once, join [start, prompt, end] with ", ", then roll the wrapped
  // text (folding each fired block's Auto Begin/End when "use block auto-sections" is on).
  const wrap = getS("wrapper") || { start: "", end: "" };
  const wrapActive = !!(wrap.start?.trim() || wrap.end?.trim());
  const setWrap = (patch) => setS("wrapper", { ...wrap, ...patch });
  const renderPart = useCallback(
    (part, seed) => {
      if (!part || !part.trim()) return "";
      try {
        return run.generatePrompt({ ...settings, prompt: part, autoSink: null }, seed) || "";
      } catch {
        return part;
      }
    },
    [settings],
  );
  const rollPrompts = useCallback(() => {
    if (!wrapActive) return run.generatePrompts(settings);
    const count = atLeast1(promptCount);
    const base =
      settings.randomSeed === false && String(settings.promptSeed ?? "").trim() !== ""
        ? String(settings.promptSeed).trim()
        : String(Math.floor(Math.random() * 0x7fffffff));
    const useAuto = settings.useAutoSections !== false;
    const out = [];
    for (let i = 0; i < count; i++) {
      const fseed = `${base}#${i}`;
      const wrapped = [renderPart(wrap.start, fseed), prompt, renderPart(wrap.end, fseed)]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join(", ");
      const sink = { begin: [], end: [] };
      const result = run.generatePrompt({ ...settings, prompt: wrapped, autoSink: useAuto ? sink : null }, fseed);
      const framed = useAuto
        ? [sink.begin.join(", "), result, sink.end.join(", ")].map((s) => s.trim()).filter(Boolean).join(", ")
        : result;
      out.push(framed);
    }
    return { seed: base, prompts: out };
  }, [wrapActive, wrap.start, wrap.end, settings, promptCount, prompt, renderPart]);

  const generate = useCallback(async () => {
    if (generating) return;

    // Time the ROLL itself, and say so out loud (logcat).
    //
    // Not decoration: the on-device suite measures the wall-clock from "tap generate" to "N generated"
    // renders, which is engine + render + list mount in one number — and when that number went bad at
    // N=1000 there was no way to tell WHICH. (The previous guess, "it's FlashList's web renderer",
    // was wrong and cost a session.) This line splits it: engine time here, everything else is the
    // difference. Hermes keeps console.log in release, and the Detox run captures logcat.
    const t0 = Date.now();
    const { seed, prompts: rolled } = rollPrompts();
    // eslint-disable-next-line no-console
    console.log(`[rap-perf] roll ${rolled.length} prompts: ${Date.now() - t0}ms (engine only)`);
    setCopiedId(null);

    // Text rewrite (auto-fix / keyword-translate) with the selected Text provider, if toggled on.
    let prompts = rolled;
    const rprov = canRewrite ? getTextProvider(rewriteProvider) : null;
    if (rprov && (autoFix || autoKeyword)) {
      const rkey = await getKey(rewriteProvider);
      if (!rkey) {
        setGenMsg(`Add your ${rprov.label} key in the ⋯ menu to use auto-fix / keyword rewrite.`);
      } else {
        setGenerating(true);
        try {
          const out = [];
          for (let i = 0; i < rolled.length; i++) {
            setGenMsg(`Rewriting prompt ${i + 1} of ${rolled.length}…`);
            let t = rolled[i];
            const rs = { backendUrl };
            if (autoFix) t = (await rprov.rewrite({ prompt: t, key: rkey, system: systemFor("fix"), mode: "fix", settings: rs })).text || t;
            if (autoKeyword) t = (await rprov.rewrite({ prompt: t, key: rkey, system: systemFor("keyword"), mode: "keyword", settings: rs })).text || t;
            out.push(t);
          }
          prompts = out;
        } catch (e) {
          setGenMsg(`Rewrite error: ${e?.message || e}`);
          prompts = rolled;
        }
        setGenerating(false);
      }
    }

    const batchId = `${seed}-${batchSeq.current++}`;
    setResults((prev) => [...prompts.map((text, i) => ({ id: `${batchId}:${i}`, text })), ...prev]);

    // Copy providers (plain / novelai) or none → prompts only.
    const prov = getImageProvider(provider);
    if (!prov || prov.copy) {
      // Always clear the transient "Rewriting…" status — even when autoFix/autoKeyword ran — so it
      // doesn't linger after generation actually finished on the copy/no-provider path.
      setGenMsg("");
      return;
    }
    // Local providers (ComfyUI / Forge / SD.Next) need no key — they hit the user's own server.
    const key = prov.local ? "" : await getKey(provider);
    if (!prov.local && !key) {
      setGenMsg(`Add your ${prov.label} API key in the ⋯ menu to generate images.`);
      return;
    }
    // Generate one image per prompt, saving each into the Gallery as it lands.
    const provSettings = { ...providerDefaults(provider), ...(providerSettings[provider] || {}), backendUrl };
    const model = provSettings.model || provSettings.comfyCheckpoint || undefined;
    setGenerating(true);
    let saved = 0;
    let error = "";
    for (let i = 0; i < prompts.length; i++) {
      setGenMsg(`Generating image ${i + 1} of ${prompts.length}…`);
      try {
        const { images } = await prov.generate({ prompt: prompts[i], key, settings: provSettings });
        const negText = provSettings.negativePrompt || "";
        const savedItems = [];
        for (const img of images) {
          const it = await saveImageSrc(img, {
            prompt: prompts[i],
            negative: negText,
            layers: {
              dpl: prompt,
              roll: rolled[i] ?? null,
              ai: autoFix || autoKeyword ? prompts[i] : null,
              final: prompts[i],
            },
            negativeLayers: negText ? { final: negText } : null,
            provider,
            providerLabel: prov.label,
            model,
            seed,
            size: sizeFromSettings(provSettings),
            settings: provSettings,
          });
          if (it) savedItems.push(it); // { name, uri } — the SAVED gallery item
          saved++;
        }
        // Attach the batch to its prompt row so images show INLINE on Generate (web parity), not only
        // in the Gallery. Tapping one opens it in the Single view.
        if (savedItems.length) {
          const rowId = `${batchId}:${i}`;
          setResults((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, images: [...(r.images || []), ...savedItems] } : r)),
          );
        }
        if (saved) onGenerated?.();
      } catch (e) {
        error = e?.message || String(e);
        break;
      }
    }
    setGenerating(false);
    setGenMsg(
      error ? `Error: ${error}` : `Saved ${saved} image${saved === 1 ? "" : "s"} to the Gallery.`,
    );
  }, [generating, rollPrompts, settings, provider, rewriteProvider, canRewrite, autoFix, autoKeyword, providerSettings, backendUrl, onGenerated]);

  // When did the rows actually COMMIT? (logcat timestamps do the arithmetic.)
  //
  // The on-device gate showed the engine is linear and fine (1000 prompts in 13.3 s) while the run as a
  // whole never finished — so the cost is after the roll. This says whether React has committed the rows
  // (and the wait is then in the test harness / the native list's measurement) or whether the commit
  // itself is the wall. Cheap, permanent, and it is the difference between fixing the app and fixing the
  // test.
  useEffect(() => {
    if (!results.length) return;
    // eslint-disable-next-line no-console
    console.log(`[rap-perf] committed ${results.length} result rows`);
  }, [results.length]);

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
  // Share link: copy a URL that restores these settings on the web app (mirrors the web share button).
  const share = useCallback(async () => {
    await Clipboard.setStringAsync(shareUrl(settings));
    setGenMsg("Share link copied to clipboard ✓");
  }, [settings]);

  // Generate images for a SINGLE result row (the web per-prompt "generate images" action) — saves each
  // into the Gallery and attaches thumbnails back onto that row.
  const canImages = !!imgProv && !imgProv.copy;
  const genImagesFor = useCallback(
    async (item) => {
      const prov = getImageProvider(provider);
      if (!prov || prov.copy) {
        setGenMsg("Pick an image provider in the ⋯ menu to generate images.");
        return;
      }
      const key = prov.local ? "" : await getKey(provider);
      if (!prov.local && !key) {
        setGenMsg(`Add your ${prov.label} API key in the ⋯ menu to generate images.`);
        return;
      }
      const provSettings = { ...providerDefaults(provider), ...(providerSettings[provider] || {}), backendUrl };
      const model = provSettings.model || provSettings.comfyCheckpoint || undefined;
      setRowBusy(item.id);
      try {
        const { images } = await prov.generate({ prompt: item.text, key, settings: provSettings });
        const negText = provSettings.negativePrompt || "";
        const savedItems = [];
        for (const img of images) {
          const it = await saveImageSrc(img, {
            prompt: item.text,
            negative: negText,
            layers: { final: item.text },
            negativeLayers: negText ? { final: negText } : null,
            provider,
            providerLabel: imgProv?.label,
            model,
            size: sizeFromSettings(provSettings),
            settings: provSettings,
          });
          if (it) savedItems.push(it); // store the SAVED { name, uri }, not the raw provider source —
          // Single resolves by gallery uri, so raw sources could never be opened.
        }
        setResults((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, images: [...(r.images || []), ...savedItems] } : r,
          ),
        );
        onGenerated?.();
      } catch (e) {
        setGenMsg(`Error: ${e?.message || e}`);
      }
      setRowBusy(null);
    },
    [provider, providerSettings, backendUrl, imgProv, onGenerated],
  );

  // Insert into whichever field is active (Prompt, or Negative when that tab is selected) — matches the
  // gutter "+" which already targets setActiveValue — rather than always writing to the Prompt.
  const insertToken = useCallback(
    (token) => {
      setActiveValue((p) => (p.trim() ? `${p.trim()}, ${token}` : token));
      setPaletteOpen(false);
    },
    [setActiveValue],
  );
  // Insert a DPL snippet from the Insert menu at the end (line constructs onto a fresh line).
  const insertSnippet = useCallback(
    (text) => {
      setActiveValue((p) => {
        if (!p.trim()) return text;
        return /\n\s*$/.test(p) || p.endsWith("\n") ? p + text : `${p}\n${text}`;
      });
    },
    [setActiveValue],
  );

  const header = (
    <View>
      <View style={styles.card}>
        <InsertMenu onInsert={insertSnippet} />

        <View style={[styles.editor, focused && styles.editorFocus]}>
          <View style={styles.editorHead}>
            <View style={styles.editorHeadLeft}>
              {valid ? (
                <CheckIcon size={16} color={T.accentStrong} />
              ) : (
                <Text style={styles.badMark}>✕</Text>
              )}
              {supportsNegative && (
                <View style={styles.cmTabs}>
                  <TouchableOpacity accessibilityRole="button"
                    style={[styles.cmTab, editMode === "prompt" && styles.cmTabOn]}
                    onPress={() => setComposeMode("prompt")}
                  >
                    <Text style={[styles.cmTabText, editMode === "prompt" && styles.cmTabTextOn]}>Prompt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button"
                    style={[styles.cmTab, editMode === "negative" && styles.cmTabOn]}
                    onPress={() => setComposeMode("negative")}
                  >
                    <Text style={[styles.cmTabText, editMode === "negative" && styles.cmTabTextOn]}>Negative</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.editorHeadRight}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setPreviewOn((v) => !v)} style={styles.headIcon} accessibilityLabel="Toggle live preview">
                <EyeIcon size={18} color={previewOn ? T.accent : T.muted} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setGearOpen(true)} style={styles.headIcon} accessibilityLabel="Prompt settings">
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
                    <TouchableOpacity accessibilityRole="button"
                      onPress={() => setActiveValue((p) => (p.endsWith("\n") || !p ? p : p + "\n"))}
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
              value={activeValue}
              onChangeText={(t) => {
                setActiveValue(t);
                setCaretTick((n) => n + 1);
              }}
              onSelectionChange={(e) => {
                caret.current = e.nativeEvent.selection.end;
                setCaretTick((n) => n + 1);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              // Web parity (PromptComposer): the empty box advertises the rotating random
              // suggestion ("Try: …"), so the shuffle button next to it has an obvious meaning.
              placeholder={
                editMode === "negative"
                  ? "Negative prompt — what to keep out"
                  : suggestion
                    ? `Try: ${suggestion}`
                    : "{#random-words}"
              }
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
                <TouchableOpacity accessibilityRole="button"
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
              <TouchableOpacity accessibilityRole="button"
                style={styles.countBtn}
                onPress={() => setPromptCount((n) => atLeast1(n - 1))}
                accessibilityLabel="One fewer prompt"
              >
                <Text style={styles.countBtnText}>−</Text>
              </TouchableOpacity>
              {/*
                The count is EDITABLE, not stepper-only — web parity (PromptComposer uses a numeric
                input). Without this, a large roll was reachable only by tapping + hundreds of times,
                which is not a feature, it's a dare. Found while writing the max-load perf test: the
                test was absurd because the UI was.

                No upper bound, and no maxLength: 1000 is the level the app SUPPORTS with no
                performance loss, not a cap it enforces. The app never tells the user "no".
              */}
              <TextInput
                testID="prompt-count"
                style={styles.countInput}
                value={String(promptCount)}
                onChangeText={(v) => {
                  const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                  setPromptCount(Number.isFinite(n) ? atLeast1(n) : 1);
                }}
                keyboardType="number-pad"
                selectTextOnFocus
                accessibilityLabel="Number of prompts per roll"
              />
              <TouchableOpacity accessibilityRole="button"
                style={styles.countBtn}
                onPress={() => setPromptCount((n) => n + 1)}
                accessibilityLabel="One more prompt"
              >
                <Text style={styles.countBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Inline image controls (Images count + Size/Ratio) — capability-driven from the provider. */}
            {imgBatchField && (
              <View style={styles.promptsCount}>
                <Text style={styles.promptsLabel}>IMAGES</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.countBtn} onPress={() => setImgParam("batchSize", clamp((Number(imgGet("batchSize", 1)) || 1) - 1, 1, 8))}>
                  <Text style={styles.countBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.countVal}>{imgGet("batchSize", 1)}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.countBtn} onPress={() => setImgParam("batchSize", clamp((Number(imgGet("batchSize", 1)) || 1) + 1, 1, 8))}>
                  <Text style={styles.countBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
            {imgSizeField && imgSizeField.options && (
              <View style={styles.sizeInline}>
                <Text style={styles.promptsLabel}>{imgSizeField.key === "aspectRatio" ? "RATIO" : "SIZE"}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sizeChips}>
                  {imgSizeField.options.map((opt) => {
                    const val = typeof opt === "object" ? opt.value : opt;
                    const lab = typeof opt === "object" ? opt.label : opt;
                    const on = imgGet(imgSizeField.key, imgSizeField.default) === val;
                    return (
                      <TouchableOpacity accessibilityRole="button" key={String(val)} style={[styles.setChip, on && styles.setChipOn]} onPress={() => setImgParam(imgSizeField.key, val)}>
                        <Text style={[styles.setChipText, on && styles.setChipTextOn]}>{lab}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.toolGroup}>
              <ToolBtn on={autoFix} disabled={!canRewrite} onPress={() => setAutoFix((v) => !v)} accessibilityLabel={canRewrite ? "Auto-fix the prompt with the Text provider" : "Auto-fix (locked — pick a Text provider)"}>
                <WandIcon size={18} color={autoFix ? T.accent : canRewrite ? T.muted : T.faint} />
              </ToolBtn>
              <ToolBtn on={autoKeyword} disabled={!canRewrite} onPress={() => setAutoKeyword((v) => !v)} accessibilityLabel={canRewrite ? "Translate the prompt to keywords" : "Keyword translate (locked — pick a Text provider)"}>
                <TagIcon size={18} color={autoKeyword ? T.accent : canRewrite ? T.muted : T.faint} />
              </ToolBtn>
              <ToolBtn on={wrapActive} onPress={() => setWrapperOpen(true)} accessibilityLabel="Prompt wrapper">
                <BracketsIcon size={18} color={wrapActive ? T.accent : T.muted} />
              </ToolBtn>
              <ToolBtn onPress={share} accessibilityLabel="Share a link to this setup">
                <ShareIcon size={17} color={T.muted} />
              </ToolBtn>
              {/*
                Random suggestion (web parity: PromptComposer's shuffle). This slot used to hold a
                SECOND building-blocks button — an exact duplicate of the green FAB below it, same
                icon, same handler — which meant the shuffle feature was missing from mobile
                altogether. Caught by LOOKING at a screenshot; no marker/render test could see it.
                Locked (not error-on-press) while there's no suggestion yet, like every other
                capability-gated control.
              */}
              <ToolBtn
                disabled={!suggestion}
                onPress={useSuggestion}
                accessibilityLabel={
                  suggestion ? "Random suggestion" : "Random suggestion (locked — none yet)"
                }
              >
                <ShuffleIcon size={17} color={suggestion ? T.muted : T.faint} />
              </ToolBtn>
            </View>
          </View>

          <TouchableOpacity accessibilityRole="button"
            testID="generate"
            style={[styles.genRound, generating && styles.genRoundBusy]}
            onPress={generate}
            accessibilityLabel="Generate prompts"
            disabled={generating}
            activeOpacity={0.85}
          >
            <SparkleIcon size={22} color={T.accentInk} />
          </TouchableOpacity>
        </View>

        {genMsg ? (
          <Text style={[styles.genMsg, genMsg.startsWith("Error") && styles.genMsgErr]}>
            {genMsg}
          </Text>
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsHead}>
          <Text style={styles.resultsTitle}>Prompts</Text>
          <View style={styles.resultsHeadRight}>
            <Text testID="results-count" style={styles.count}>
              {results.length} generated
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={copyAll}>
              <Text style={styles.copyLink}>Copy all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="clear-all"
              accessibilityRole="button"
              onPress={() => setResults([])}
            >
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
        testID="results-list"
        data={results}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listPad}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <ResultRow
            number={results.length - index}
            text={item.text}
            images={item.images}
            copied={copiedId === item.text}
            onCopy={copy}
            onOpenImage={onOpenImage}
            canImages={canImages}
            busy={rowBusy === item.id}
            onGenImages={() => genImagesFor(item)}
          />
        )}
        estimatedItemSize={104}
      />

      {/* The ONE building-blocks control (the web's off-canvas drawer). The toolbar above used to
          carry a second, identical one — see the regression test in __tests__/GenerateScreen.test.jsx. */}
      <TouchableOpacity accessibilityRole="button"
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setPaletteOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open the building-blocks palette"
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
          <TouchableOpacity accessibilityRole="button"
            style={{ flex: 1 }}
            onPress={() => setGearOpen(false)}
            activeOpacity={1}
          />
          <View style={styles.gearSheet}>
            <View style={styles.gearHead}>
              <Text style={styles.gearTitle}>Prompt settings</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setGearOpen(false)}>
                <Text style={styles.gearClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.gearScroll}
              contentContainerStyle={styles.gearBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity accessibilityRole="button" style={styles.resetBtn} onPress={() => setCfg({})}>
                <Text style={styles.resetText}>Reset to defaults</Text>
              </TouchableOpacity>

              {grp("Seed", [
                toggleRow("Random seed", "randomSeed", true),
                textRow("Seed", "promptSeed", getS("randomSeed") !== false),
              ])}
              {grp("Vocabulary", [
                selectRow("Keyword list", "keywordsFilename", LIST_OPTIONS),
                selectRow("Artist list", "artistFilename", LIST_OPTIONS),
                toggleRow("Natural language for artists & styles", "naturalArtistStyle", true),
              ])}
              {grp("Emphasis", [
                toggleRow("Randomly emphasize keywords", "keywordEmphasis"),
                numRow("Emphasis chance", "emphasisChance"),
                numRow("Extra-level chance", "emphasisLevelChance"),
                numRow("Max levels", "emphasisMaxLevels"),
                numRow("De-emphasis chance", "deEmphasisChance"),
              ])}
              {grp("Editing & alternating", [
                toggleRow("Keyword editing", "keywordEditing"),
                numRow("Editing min", "keywordEditingMin"),
                numRow("Editing max", "keywordEditingMax"),
                toggleRow("Keyword alternating", "keywordAlternating"),
                numRow("Alternating max levels", "keywordAlternatingMaxLevels"),
              ])}
              {grp("Salt & lists", [
                toggleRow("Prompt salt", "promptSalt"),
                numRow("Salt start (-1 = random)", "promptSaltStart"),
                toggleRow("Don't combine with AND", "noAnd"),
                toggleRow("List entries used once", "listEntriesUsedOnce"),
                toggleRow("Reload lists each prompt", "reloadListsOnPromptChange"),
              ])}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={wrapperOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setWrapperOpen(false)}
      >
        <View style={styles.sheetScrim}>
          <TouchableOpacity accessibilityRole="button" style={{ flex: 1 }} onPress={() => setWrapperOpen(false)} activeOpacity={1} />
          <View style={styles.gearSheet}>
            <View style={styles.gearHead}>
              <Text style={styles.gearTitle}>Wrapper</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setWrapperOpen(false)}>
                <Text style={styles.gearClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.gearScroll}
              contentContainerStyle={styles.gearBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.wrapHint}>
                Frames every generated prompt with a start and end (DPL is allowed, so {"{#…}"} blocks
                re-roll per prompt). Joined as: start, prompt, end.
              </Text>
              <Text style={styles.grpTitle}>Start</Text>
              <TextInput
                style={styles.wrapInput}
                value={wrap.start}
                onChangeText={(t) => setWrap({ start: t })}
                placeholder="e.g. masterpiece, best quality"
                placeholderTextColor={T.faint}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <Text style={styles.grpTitle}>End</Text>
              <TextInput
                style={styles.wrapInput}
                value={wrap.end}
                onChangeText={(t) => setWrap({ end: t })}
                placeholder="e.g. {#fx}, {#artists}"
                placeholderTextColor={T.faint}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <View style={styles.setRow}>
                <Text style={styles.setRowLabel}>Use block auto-sections</Text>
                <Switch
                  value={getS("useAutoSections") !== false}
                  onValueChange={(v) => setS("useAutoSections", v)}
                  trackColor={{ true: T.accent, false: T.border }}
                  thumbColor="#fff"
                />
              </View>
              <TouchableOpacity accessibilityRole="button"
                style={styles.resetBtn}
                onPress={() => {
                  setS("wrapper", { start: "", end: "" });
                }}
              >
                <Text style={styles.resetText}>Clear wrapper</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const CODE_FONT = 14.5;
const CODE_LH = 22;

const makeStyles = (T) =>
  StyleSheet.create({
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
    editorHeadLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
    editorHeadRight: { flexDirection: "row", alignItems: "center" },
    headIcon: { paddingHorizontal: 8, paddingVertical: 2 },
    badMark: { color: T.dangerFg, fontSize: 16, fontWeight: "800" },

    cmTabs: {
      flexDirection: "row",
      gap: 4,
      backgroundColor: T.panel,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      padding: 2,
    },
    cmTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: T.radiusPill },
    cmTabOn: { backgroundColor: T.accentSoft },
    cmTabText: { color: T.muted, fontSize: 12.5, fontWeight: "700" },
    cmTabTextOn: { color: T.accent },

    sizeInline: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    sizeChips: { flexDirection: "row", gap: 6, paddingRight: 6 },

    codeRow: { flexDirection: "row" },
    gutter: {
      paddingRight: 12,
      marginRight: 12,
      borderRightWidth: 1,
      borderRightColor: T.borderSoft,
    },
    gutterLine: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
    gutterNum: {
      color: T.faint,
      fontSize: CODE_FONT,
      lineHeight: CODE_LH,
      fontFamily: "monospace",
    },
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
    // The count is an editable field, so it needs a FIXED width. Reusing the old Text style
    // (`countVal`, which only sets minWidth) let the input stretch and shove the + stepper off the
    // screen — invisible to every test, obvious the moment you look at a screenshot.
    countInput: {
      color: T.fg,
      fontSize: 16,
      fontWeight: "800",
      width: 54,
      textAlign: "center",
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: T.input,
      borderWidth: 1,
      borderColor: T.border,
    },

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
    genRoundBusy: { opacity: 0.55 },
    genMsg: { color: T.muted, fontSize: 13, marginTop: 12, textAlign: "center" },
    genMsgErr: { color: T.dangerFg },

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
    resultHeadRight: { flexDirection: "row", alignItems: "center", gap: 16 },
    copyLink: { color: T.accent, fontSize: 13, fontWeight: "700" },
    resultText: { color: T.fgSoft, fontSize: 15, lineHeight: 22 },
    resultThumbs: { flexDirection: "row", gap: 8, paddingTop: 10 },
    resultThumb: {
      width: 84,
      height: 84,
      borderRadius: T.radiusSm,
      backgroundColor: T.input,
      borderWidth: 1,
      borderColor: T.borderSoft,
    },

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
      maxHeight: "82%",
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
    gearScroll: { flexGrow: 0 },
    gearBody: { paddingHorizontal: 18, paddingBottom: 32, paddingTop: 4 },
    resetBtn: {
      alignSelf: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      marginBottom: 6,
    },
    resetText: { color: T.muted, fontSize: 12.5, fontWeight: "700" },
    wrapHint: { color: T.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
    wrapInput: {
      color: T.fg,
      fontSize: 14,
      fontFamily: "monospace",
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: 54,
      textAlignVertical: "top",
      marginBottom: 6,
    },
    grp: { marginTop: 12 },
    grpTitle: {
      color: T.muted,
      fontSize: 11.5,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      gap: 12,
    },
    setRowLabel: { color: T.fgSoft, fontSize: 14.5, flex: 1 },
    setNum: {
      color: T.fg,
      fontSize: 14,
      minWidth: 74,
      textAlign: "right",
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    setTextInput: {
      color: T.fg,
      fontSize: 14,
      minWidth: 140,
      flexShrink: 1,
      textAlign: "right",
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    setSelBlock: { paddingVertical: 8 },
    setChips: { flexDirection: "row", gap: 8, paddingVertical: 6, paddingRight: 8 },
    setChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    setChipOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
    setChipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },
    setChipTextOn: { color: T.accent },
  });
