/**
 * Read-only browser of the built-in catalog (the baked metro catalog) for Manage — the RN counterpart to
 * the web Manage's built-in tree. The built-in content can't be edited in place on device (it's compiled
 * into the app), so each entry offers **Override**: copy its source into the editable user overlay, where
 * it wins over the built-in and can be edited freely (the web's "Create override"). A search box gates the
 * (89 block + 88 list) catalog so nothing renders until you look for something.
 * @module components/BuiltinBrowser
 */
import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { metroLoader } from "engine/core/metroLoader.js";
import { useTheme } from "../lib/theme.js";

const CAP = 60; // max rows per kind (keeps a broad query cheap)

/**
 * @param {object} props
 * @param {Function} props.onOverride `(kind, key, source)` — copy a built-in into the user overlay.
 * @returns {JSX.Element}
 */
export default function BuiltinBrowser({ onOverride }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [q, setQ] = useState("");

  const blocks = useMemo(() => metroLoader.blockNames().filter((k) => typeof k === "string"), []);
  const lists = useMemo(() => metroLoader.listNames().filter((k) => typeof k === "string"), []);

  const needle = q.trim().toLowerCase();
  const mBlocks = needle ? blocks.filter((k) => k.toLowerCase().includes(needle)).slice(0, CAP) : [];
  const mLists = needle ? lists.filter((k) => k.toLowerCase().includes(needle)).slice(0, CAP) : [];

  const overrideBlock = (key) => onOverride("block", key, metroLoader.readBlockSource(key) || "");
  const overrideList = (key) =>
    onOverride("list", key, (metroLoader.readListLines(key, true) || []).join("\n"));

  return (
    <View>
      <TextInput
        style={styles.search}
        value={q}
        onChangeText={setQ}
        placeholder={`Search the built-in catalog (${blocks.length} blocks · ${lists.length} lists)…`}
        placeholderTextColor={T.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!needle ? (
        <Text style={styles.hint}>
          Search to browse built-in blocks + lists. Override copies one into your editable overlay.
        </Text>
      ) : (
        <>
          {mBlocks.length > 0 && <Text style={styles.kind}>Blocks</Text>}
          {mBlocks.map((key) => (
            <View key={`b:${key}`} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {key}
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => overrideBlock(key)} hitSlop={6}>
                <Text style={styles.override}>Override</Text>
              </TouchableOpacity>
            </View>
          ))}
          {mLists.length > 0 && <Text style={styles.kind}>Lists</Text>}
          {mLists.map((key) => (
            <View key={`l:${key}`} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {key}
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => overrideList(key)} hitSlop={6}>
                <Text style={styles.override}>Override</Text>
              </TouchableOpacity>
            </View>
          ))}
          {mBlocks.length === 0 && mLists.length === 0 && (
            <Text style={styles.hint}>No built-in blocks or lists match “{q}”.</Text>
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    search: {
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 8,
    },
    hint: { color: T.faint, fontSize: 13, marginBottom: 8 },
    kind: {
      color: T.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 8,
      marginBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: T.panel,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.borderSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 6,
      gap: 10,
    },
    rowLabel: { color: T.fgSoft, fontSize: 14, flex: 1 },
    override: { color: T.accent, fontSize: 13, fontWeight: "700" },
  });
