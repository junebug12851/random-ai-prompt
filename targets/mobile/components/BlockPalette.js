import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import { useTheme } from "../lib/theme.js";
import { getBlocks } from "../lib/blockCatalog.js";
import { foldersOf } from "../lib/blockCategories.js";

// Mobile is the SFW build — nsfw-flagged blocks/lists are hidden entirely.
const INCLUDE_ADULT = false;

/**
 * The building-block palette — a bottom-sheet drawer (the web's off-canvas left pane). A search box,
 * the Blocks / Lists groups with their folder sub-tabs, category hints, and the chip cloud. Blocks
 * insert as {#name}, lists as {name}, group pills insert the whole-group token ({#scene}, …).
 * Faithful to the web components/home/BlockPalette.jsx.
 * @param {{ visible: boolean, onClose: () => void, onInsert: (token: string) => void }} props
 */
export default function BlockPalette({ visible, onClose, onInsert }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(""); // top group: Blocks | Lists
  const [activeSub, setActiveSub] = useState("All"); // folder sub-tab within the active group

  const blocks = useMemo(() => getBlocks({ includeAdult: INCLUDE_ADULT }), []);

  const q = query.trim().toLowerCase();
  const matchItem = (i) =>
    (i.token || "").toLowerCase().includes(q) || (i.label || "").toLowerCase().includes(q);
  function filterItems(items) {
    if (!q) return items;
    const out = [];
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      if (i.category) {
        let any = false;
        for (let j = k + 1; j < items.length && !items[j].category; j++)
          if (matchItem(items[j])) {
            any = true;
            break;
          }
        if (any) out.push(i);
      } else if (matchItem(i)) {
        out.push(i);
      }
    }
    return out;
  }
  const filtered = blocks
    .map((b) => ({ ...b, items: filterItems(b.items) }))
    .filter((b) => b.items.some((i) => !i.category));

  const active = filtered.find((b) => b.title === activeCat) || filtered[0] || null;
  const searching = !!q;
  const subCats = active ? foldersOf(active) : [];
  const effSub =
    activeSub === "All" || subCats.some((c) => c.label === activeSub) ? activeSub : "All";

  let activeItems;
  if (searching) {
    activeItems = active ? active.items.filter((i) => !i.category) : [];
  } else if (effSub === "All") {
    activeItems = active ? active.items : [];
  } else {
    const cat = subCats.find((c) => c.label === effSub);
    activeItems = cat
      ? [
          ...(cat.token
            ? [{ category: true, token: cat.token, label: cat.label, description: cat.description }]
            : []),
          ...cat.items,
        ]
      : [];
  }

  const hint = !searching
    ? effSub === "All"
      ? active?.hint
      : subCats.find((c) => c.label === effSub)?.description
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <TouchableOpacity accessibilityRole="button" style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Building blocks</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search blocks…"
            placeholderTextColor={T.faint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {filtered.length === 0 ? (
            <Text style={styles.empty}>No building blocks match “{query}”.</Text>
          ) : (
            <>
              {/* Group selector: Blocks / Lists, each with its chip count. */}
              <View style={styles.groups}>
                {filtered.map((b) => {
                  const on = active && active.title === b.title;
                  const count = b.items.filter((i) => !i.category).length;
                  return (
                    <TouchableOpacity accessibilityRole="button"
                      key={b.title}
                      style={[styles.group, on && styles.groupOn]}
                      onPress={() => {
                        setActiveCat(b.title);
                        setActiveSub("All");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.groupName, on && styles.groupNameOn]}>{b.title}</Text>
                      <View style={[styles.countPill, on && styles.countPillOn]}>
                        <Text style={[styles.countText, on && styles.countTextOn]}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Folder sub-tabs (hidden while searching — results go flat). A wrapping row, NOT a
                  horizontal ScrollView: on Android a horizontal ScrollView here collapsed the pills to
                  zero width (no text / wrong size). Wrapping lays out reliably and shows every folder,
                  like the web nav which also wraps. */}
              {!searching && (
                <View style={styles.subTabsWrap}>
                  <SubTab
                    label="all"
                    count={active ? active.items.filter((i) => !i.category).length : 0}
                    on={effSub === "All"}
                    onPress={() => setActiveSub("All")}
                  />
                  {subCats.map((c) => (
                    <SubTab
                      key={c.label}
                      label={c.label}
                      count={c.items.length}
                      on={effSub === c.label}
                      onPress={() => setActiveSub(c.label)}
                    />
                  ))}
                </View>
              )}

              {hint ? (
                <View style={styles.hintRow}>
                  <Text style={styles.hintIcon}>ⓘ</Text>
                  <Text style={styles.hintText}>{hint}</Text>
                </View>
              ) : null}

              <ScrollView
                contentContainerStyle={styles.chipArea}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.chips}>
                  {activeItems.slice(0, 400).map((i, idx) =>
                    i.category ? (
                      i.token ? (
                        <TouchableOpacity accessibilityRole="button"
                          key={`cat-${i.label}-${idx}`}
                          style={styles.groupPill}
                          onPress={() => onInsert(i.token)}
                        >
                          <Text style={styles.groupPillText}>{i.label}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View key={`cat-${i.label}-${idx}`} style={styles.catHeader}>
                          <Text style={styles.catHeaderText}>{i.label}</Text>
                        </View>
                      )
                    ) : (
                      <TouchableOpacity accessibilityRole="button"
                        key={i.token}
                        style={styles.chip}
                        onPress={() => onInsert(i.token)}
                      >
                        <Text style={styles.chipText}>{i.label}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                  {activeItems.length > 400 && (
                    <Text style={styles.more}>
                      +{activeItems.length - 400} more — keep typing to filter
                    </Text>
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SubTab({ label, count, on, onPress }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <TouchableOpacity accessibilityRole="button"
      style={[styles.subTab, on && styles.subTabOn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.subTabText, on && styles.subTabTextOn]}>{label}</Text>
      <Text style={[styles.subTabCount, on && styles.subTabTextOn]}>{count}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      backgroundColor: T.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      height: "82%",
      borderTopWidth: 1,
      borderColor: T.border,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 10,
    },
    title: { color: T.fg, fontSize: 17, fontWeight: "800" },
    close: { color: T.muted, fontSize: 18, fontWeight: "700", paddingHorizontal: 6 },
    search: {
      marginHorizontal: 16,
      marginBottom: 12,
      color: T.fg,
      fontSize: 15,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    empty: {
      color: T.faint,
      fontSize: 14,
      textAlign: "center",
      marginTop: 20,
      paddingHorizontal: 20,
    },

    groups: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    group: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    groupOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
    groupName: { color: T.fgSoft, fontSize: 14, fontWeight: "800" },
    groupNameOn: { color: T.accent },
    countPill: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      backgroundColor: T.chip,
      alignItems: "center",
    },
    countPillOn: { backgroundColor: T.accent },
    countText: { color: T.muted, fontSize: 11, fontWeight: "800" },
    countTextOn: { color: T.accentInk },

    subTabsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    subTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.elevated,
    },
    subTabOn: { borderColor: T.accent, backgroundColor: T.accentSoft },
    subTabText: { color: T.muted, fontSize: 13, fontWeight: "700" },
    subTabTextOn: { color: T.accent },
    subTabCount: { color: T.faint, fontSize: 11, fontWeight: "800" },

    hintRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 10,
    },
    hintIcon: { color: T.accent, fontSize: 13, marginTop: 1 },
    hintText: { color: T.muted, fontSize: 12.5, lineHeight: 18, flex: 1 },

    chipArea: { paddingHorizontal: 16, paddingBottom: 28 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: T.radiusPill,
      backgroundColor: T.chip,
      borderWidth: 1,
      borderColor: T.border,
    },
    chipText: { color: T.fgSoft, fontSize: 13, fontWeight: "600" },
    groupPill: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: T.radiusPill,
      backgroundColor: T.accentSoft,
      borderWidth: 1,
      borderColor: T.accent,
    },
    groupPillText: { color: T.accent, fontSize: 13, fontWeight: "800" },
    catHeader: { width: "100%", marginTop: 6, marginBottom: 2 },
    catHeaderText: {
      color: T.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    more: { color: T.faint, fontSize: 12, width: "100%", marginTop: 6 },
  });
