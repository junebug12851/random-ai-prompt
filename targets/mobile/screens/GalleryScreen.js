import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useTheme } from "../lib/theme.js";
import { listImages, deleteImages, saveImageSrc } from "../lib/storage.js";
import { run, baseSettings } from "../lib/engine.js";
import { getImageProvider, providerDefaults } from "../lib/imageProviders.js";
import { getKey } from "../lib/keys.js";
import { SparkleIcon } from "../lib/icons.js";

// One thumbnail cell — memoized (like the web's <Thumb>) so at the 100k max a single selection toggle
// re-renders ONLY that cell, not every visible one. `selected` is passed as a boolean (not the Set) so
// memo's shallow compare is exact. Builds its own styles from the theme (stable unless the theme flips).
const Cell = memo(function Cell({ item, size, pad, selectMode, selected, onPress, onLong }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLong(item)}
      activeOpacity={0.85}
      style={{ padding: pad / 2 }}
    >
      <View style={[styles.cellWrap, selected && styles.cellWrapOn]}>
        <Image
          source={item.uri}
          style={{ width: size, height: size, borderRadius: T.radiusSm, backgroundColor: T.panel2 }}
          contentFit="cover"
          recyclingKey={item.uri}
          transition={120}
          cachePolicy="disk"
        />
        {selectMode && (
          <View style={[styles.check, selected && styles.checkOn]}>
            {selected ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

/**
 * The photo gallery — a browseable feed of every image saved on the phone, faithful to the web
 * Gallery.jsx: a header with the title + count + a keyword **search** (over the prompt/provider
 * metadata) + **Select** (multi-select) + **Refresh**, a selection action bar (Select all / Clear /
 * Delete N / Done) with per-cell selection rings, and empty / no-match states — over a recycling
 * FlashList grid of uniform square thumbnails (expo-image, disk-cached) built for the 100k max load.
 */
export default function GalleryScreen({ onOpen, refreshKey, onGenerated }) {
  const { T, provider, providerSettings, backendUrl } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // uri values
  // Compact prompt composer atop the gallery (mirrors the web's PromptComposer on the gallery view):
  // roll a prompt + fire an image batch straight into this grid, with pending placeholder tiles while
  // the batch is in flight.
  const [composeText, setComposeText] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [composeMsg, setComposeMsg] = useState("");
  const imgProv = getImageProvider(provider);
  const canImages = !!imgProv && !imgProv.copy;

  const pad = 12;
  const w = Math.min(width, 900);
  const cols = Math.max(2, Math.floor(w / 180));
  const cell = Math.floor((w - pad) / cols) - pad;

  const reload = useCallback(() => {
    listImages().then((it) => {
      setItems(it);
      setLoaded(true);
      // Drop any selected uris that no longer exist.
      setSelected((prev) => {
        if (!prev.size) return prev;
        const live = new Set(it.map((i) => i.uri));
        return new Set([...prev].filter((u) => live.has(u)));
      });
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter((it) =>
      `${it.prompt || ""} ${it.provider || ""} ${it.name}`.toLowerCase().includes(q),
    );
  }, [items, q]);

  const toggle = useCallback((uri) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }, []);
  const selectAll = () => setSelected(new Set(filtered.map((i) => i.uri)));
  const clearSel = () => setSelected(new Set());
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const deleteSelected = useCallback(async () => {
    const uris = [...selected];
    if (!uris.length) return;
    await deleteImages(uris);
    setSelected(new Set());
    reload();
  }, [selected, reload]);

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.uri));

  // Roll one prompt from the composer box (DPL allowed) and fire an image batch into the gallery.
  const generateHere = useCallback(async () => {
    if (composeBusy) return;
    const prov = getImageProvider(provider);
    if (!prov || prov.copy) {
      setComposeMsg("Pick an image provider in the ⋯ menu to generate here.");
      return;
    }
    const dpl = composeText.trim() || "{#random-words}";
    const { prompts } = run.generatePrompts({ ...baseSettings, prompt: dpl, promptCount: 1, generateImages: false });
    const key = prov.local ? "" : await getKey(provider);
    if (!prov.local && !key) {
      setComposeMsg(`Add your ${prov.label} API key in the ⋯ menu to generate images.`);
      return;
    }
    const provSettings = { ...providerDefaults(provider), ...(providerSettings[provider] || {}), backendUrl };
    const model = provSettings.model || provSettings.comfyCheckpoint || undefined;
    setComposeBusy(true);
    setComposeMsg("");
    setPending(Math.max(1, Number(provSettings.batchSize) || 1));
    let saved = 0;
    let error = "";
    try {
      for (const p of prompts) {
        const { images } = await prov.generate({ prompt: p, key, settings: provSettings });
        for (const img of images) {
          await saveImageSrc(img, { prompt: p, provider, model });
          saved++;
        }
      }
    } catch (e) {
      error = e?.message || String(e);
    }
    setPending(0);
    setComposeBusy(false);
    setComposeMsg(error ? `Error: ${error}` : saved ? "" : "No images returned.");
    if (saved) {
      reload();
      onGenerated?.();
    }
  }, [composeBusy, composeText, provider, providerSettings, backendUrl, reload, onGenerated]);

  const header = (
    <View style={styles.head}>
      {/* Compact composer — generate straight into the gallery without leaving this tab. */}
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={composeText}
          onChangeText={setComposeText}
          placeholder="{#random-words} — prompt to generate here"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.composerBtn, (composeBusy || !canImages) && styles.composerBtnOff]}
          onPress={generateHere}
          disabled={composeBusy || !canImages}
          activeOpacity={0.85}
        >
          <SparkleIcon size={18} color={T.accentInk} />
        </TouchableOpacity>
      </View>
      {composeMsg ? (
        <Text style={[styles.composerMsg, composeMsg.startsWith("Error") && { color: T.dangerFg }]}>
          {composeMsg}
        </Text>
      ) : null}
      {pending > 0 && (
        <View style={styles.pendingRow}>
          {Array.from({ length: pending }, (_, i) => (
            <View key={i} style={[styles.pendingCell, { width: cell, height: cell }]}>
              <Text style={styles.pendingDots}>…</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.headTop}>
        <Text style={styles.title}>Photo gallery</Text>
        <Text style={styles.count}>
          {!loaded ? "loading…" : `${items.length} image${items.length === 1 ? "" : "s"}`}
          {loaded && q ? ` · ${filtered.length} match${filtered.length === 1 ? "" : "es"}` : ""}
        </Text>
      </View>
      <View style={styles.headRow}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search prompts, provider…"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!selectMode && items.length > 0 && (
          <TouchableOpacity style={styles.headBtn} onPress={() => setSelectMode(true)}>
            <Text style={styles.headBtnText}>Select</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.headBtn} onPress={reload}>
          <Text style={styles.headBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {selectMode && (
        <View style={styles.selBar}>
          <Text style={styles.selCount}>
            {selected.size === 0 ? "None selected" : `${selected.size} selected`}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={selectAll} disabled={filtered.length === 0 || allSelected}>
            <Text
              style={[styles.selLink, (filtered.length === 0 || allSelected) && styles.selDisabled]}
            >
              Select all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearSel} disabled={selected.size === 0}>
            <Text style={[styles.selLink, selected.size === 0 && styles.selDisabled]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.delBtn, selected.size === 0 && styles.selDisabled]}
            onPress={deleteSelected}
            disabled={selected.size === 0}
          >
            <Text style={styles.delBtnText}>Delete {selected.size || ""}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exitSelect}>
            <Text style={styles.selLink}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {loaded && items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyTitle}>No images yet</Text>
          <Text style={styles.emptyBody}>
            Set an image provider + API key in the ⋯ menu, then Generate — every image lands here
            (smooth to 100k).{" "}
          </Text>
        </View>
      )}
      {loaded && items.length > 0 && filtered.length === 0 && (
        <Text style={styles.none}>No images match “{query}”.</Text>
      )}
    </View>
  );

  // Stable per-cell handlers so the memoized Cell only re-renders when its own props change.
  const onPressCell = useCallback(
    (item) => (selectMode ? toggle(item.uri) : onOpen?.(item)),
    [selectMode, toggle, onOpen],
  );
  const onLongCell = useCallback(
    (item) => {
      if (!selectMode) {
        setSelectMode(true);
        toggle(item.uri);
      }
    },
    [selectMode, toggle],
  );

  return (
    <FlashList
      data={filtered}
      key={cols}
      numColumns={cols}
      keyExtractor={(it) => it.uri}
      estimatedItemSize={cell + pad}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: pad / 2 }}
      renderItem={({ item }) => (
        <Cell
          item={item}
          size={cell}
          pad={pad}
          selectMode={selectMode}
          selected={selected.has(item.uri)}
          onPress={onPressCell}
          onLong={onLongCell}
        />
      )}
    />
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    head: { paddingHorizontal: 10, paddingTop: 14, paddingBottom: 6 },
    composer: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    composerInput: {
      flex: 1,
      color: T.fg,
      fontSize: 14,
      fontFamily: "monospace",
      backgroundColor: T.input,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    composerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: T.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    composerBtnOff: { opacity: 0.5 },
    composerMsg: { color: T.muted, fontSize: 12.5, marginBottom: 8 },
    pendingRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    pendingCell: {
      borderRadius: T.radiusSm,
      backgroundColor: T.input,
      borderWidth: 1,
      borderColor: T.border,
      alignItems: "center",
      justifyContent: "center",
    },
    pendingDots: { color: T.faint, fontSize: 22, fontWeight: "800" },
    headTop: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 },
    title: { color: T.fg, fontSize: 20, fontWeight: "800" },
    count: { color: T.muted, fontSize: 13 },
    headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    search: {
      flex: 1,
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    headBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    headBtnText: { color: T.fgSoft, fontSize: 13, fontWeight: "700" },

    selBar: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 12,
      padding: 10,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.input,
    },
    selCount: { color: T.fg, fontSize: 13, fontWeight: "700" },
    selLink: { color: T.accent, fontSize: 13, fontWeight: "700" },
    selDisabled: { opacity: 0.4 },
    delBtn: {
      backgroundColor: T.dangerBg,
      borderWidth: 1,
      borderColor: T.dangerBorder,
      borderRadius: T.radiusSm,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    delBtnText: { color: T.dangerFg, fontSize: 13, fontWeight: "800" },

    cellWrap: { borderRadius: T.radiusSm, borderWidth: 2, borderColor: "transparent" },
    cellWrapOn: { borderColor: T.accent },
    check: {
      position: "absolute",
      top: 6,
      left: 6,
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "#fff",
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: T.accent, borderColor: T.accent },
    checkMark: { color: T.accentInk, fontSize: 13, fontWeight: "800" },

    none: { color: T.faint, fontSize: 14, textAlign: "center", marginTop: 24 },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 24,
    },
    emptyIcon: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 8 },
    emptyBody: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  });
