import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTheme } from "../lib/theme.js";
import { sortLines, dedupeLines } from "../lib/listOps.js";
import ManageBlockEditor from "../components/ManageBlockEditor.js";
import {
  listUserLists,
  readUserList,
  writeUserList,
  deleteUserList,
  listUserBlocks,
  writeUserBlock,
  deleteUserBlock,
  storageAvailable,
} from "../lib/storage.js";

// One editable line. The input is UNCONTROLLED (defaultValue) and writes straight into the shared line
// object on change — so typing never re-renders the (up to 100k-row) list. Memoized on the line object.
const LineRow = memo(function LineRow({ line, onCommit, onDelete }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={styles.lineRow}>
      <TextInput
        style={styles.lineInput}
        defaultValue={line.text}
        onChangeText={(t) => onCommit(line, t)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="(empty)"
        placeholderTextColor={T.faint}
      />
      <TouchableOpacity onPress={() => onDelete(line)} hitSlop={10}>
        <Text style={styles.lineDel}>✕</Text>
      </TouchableOpacity>
    </View>
  );
});

// The windowed editor for one list — master/detail's detail pane (the web Manage's phone layout).
function Editor({ name, onClose }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const linesRef = useRef([]);
  const nextId = useRef(0);
  const [view, setView] = useState([]);
  const [filter, setFilter] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  const recompute = useCallback((f) => {
    const all = linesRef.current;
    if (!f) {
      setView(all.slice());
      return;
    }
    const needle = f.toLowerCase();
    const out = [];
    for (let i = 0; i < all.length; i++)
      if (all[i].text.toLowerCase().includes(needle)) out.push(all[i]);
    setView(out);
  }, []);

  useEffect(() => {
    readUserList(name).then((text) => {
      const arr = text.length ? text.split("\n") : [];
      linesRef.current = arr.map((t) => ({ id: nextId.current++, text: t }));
      setView(linesRef.current.slice());
      setReady(true);
    });
  }, [name]);

  const onCommit = useCallback((line, t) => {
    line.text = t;
  }, []);
  const onDelete = useCallback(
    (line) => {
      const all = linesRef.current;
      const i = all.indexOf(line);
      if (i >= 0) all.splice(i, 1);
      recompute(filter);
    },
    [filter, recompute],
  );
  const add = useCallback(() => {
    linesRef.current.unshift({ id: nextId.current++, text: "" });
    setFilter("");
    recompute("");
  }, [recompute]);
  // Sort / Dedupe reuse the shared listOps (lockstep with the web list editor). They rebuild the line
  // objects with fresh ids so every (uncontrolled) row remounts showing its new text.
  const sort = useCallback(() => {
    const texts = sortLines(linesRef.current.map((l) => l.text));
    linesRef.current = texts.map((t) => ({ id: nextId.current++, text: t }));
    setStatus("Sorted A→Z");
    recompute(filter);
  }, [filter, recompute]);
  const dedupe = useCallback(() => {
    const { lines: texts, removed } = dedupeLines(linesRef.current.map((l) => l.text));
    linesRef.current = texts.map((t) => ({ id: nextId.current++, text: t }));
    setStatus(removed ? `Removed ${removed} duplicate${removed === 1 ? "" : "s"}` : "No duplicates");
    recompute(filter);
  }, [filter, recompute]);
  const onFilter = useCallback(
    (f) => {
      setFilter(f);
      recompute(f);
    },
    [recompute],
  );
  const save = useCallback(async () => {
    await writeUserList(name, linesRef.current.map((l) => l.text).join("\n"));
    onClose(true);
  }, [name, onClose]);

  return (
    <View style={styles.editorWrap}>
      <View style={styles.editorHead}>
        <TouchableOpacity onPress={() => onClose(false)} hitSlop={8}>
          <Text style={styles.back}>‹ Lists</Text>
        </TouchableOpacity>
        <Text style={styles.editorTitle} numberOfLines={1}>
          {name}
        </Text>
        <TouchableOpacity onPress={save} hitSlop={8}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.filter}
          value={filter}
          onChangeText={onFilter}
          placeholder={`Filter ${ready ? linesRef.current.length : 0} lines`}
          placeholderTextColor={T.faint}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>+ Line</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={sort}>
          <Text style={styles.addBtnText}>Sort</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={dedupe}>
          <Text style={styles.addBtnText}>Dedupe</Text>
        </TouchableOpacity>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <FlashList
        data={view}
        keyExtractor={(l) => String(l.id)}
        estimatedItemSize={52}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 14 }}
        renderItem={({ item }) => <LineRow line={item} onCommit={onCommit} onDelete={onDelete} />}
        ListEmptyComponent={
          ready ? (
            <Text style={styles.none}>{filter ? "No matching lines." : "Empty — add a line."}</Text>
          ) : null
        }
      />
    </View>
  );
}

// One tap-to-open / delete row in a master section (blocks or lists).
function OverlayRow({ name, onOpen, onDelete, styles }) {
  return (
    <View style={styles.listRow}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onOpen}>
        <Text style={styles.listName}>{name}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text style={styles.del}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Manage the phone-local user overlay — the two editable roots the web Manage exposes, to the extent the
 * platform allows: **Blocks** (custom DPL generators) and **Lists** (custom word lists), each master/detail
 * with its own editor (block editor / windowed line editor, smooth to the 100k-line max). Built-in browsing,
 * override/restore, and the live runtime overlay follow (tracked in notes/plans/mobile-parity.md).
 */
export default function ManageScreen() {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [lists, setLists] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [editing, setEditing] = useState(null); // { kind: "list"|"block", key } | null
  const [newList, setNewList] = useState("");
  const [newBlock, setNewBlock] = useState("");

  const reload = useCallback(() => {
    listUserLists().then(setLists);
    listUserBlocks().then(setBlocks);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const clean = (s) => s.trim().replace(/[^a-z0-9_-]/gi, "");
  const createList = useCallback(async () => {
    const n = clean(newList);
    if (!n) return;
    await writeUserList(n, "");
    setNewList("");
    reload();
    setEditing({ kind: "list", key: n });
  }, [newList, reload]);
  const createBlock = useCallback(async () => {
    const n = clean(newBlock);
    if (!n) return;
    await writeUserBlock(n, "Start\n===\n");
    setNewBlock("");
    reload();
    setEditing({ kind: "block", key: n });
  }, [newBlock, reload]);
  const removeList = useCallback(
    async (name) => {
      await deleteUserList(name);
      reload();
    },
    [reload],
  );
  const removeBlock = useCallback(
    async (key) => {
      await deleteUserBlock(key);
      reload();
    },
    [reload],
  );

  if (editing?.kind === "list") {
    return (
      <Editor
        name={editing.key}
        onClose={(saved) => {
          setEditing(null);
          if (saved) reload();
        }}
      />
    );
  }
  if (editing?.kind === "block") {
    return (
      <ManageBlockEditor
        blockKey={editing.key}
        onClose={(changed) => {
          setEditing(null);
          if (changed) reload();
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.h}>Your building blocks</Text>
      <Text style={styles.hint}>
        Custom DPL generators (blocks) and word lists stored on your phone. Editors stay smooth to the
        100k-line max.{storageAvailable ? "" : " (Storage is off in the web preview.)"}
      </Text>

      <Text style={styles.section}>Blocks</Text>
      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newBlock}
          onChangeText={setNewBlock}
          placeholder="new block name"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.primary} onPress={createBlock}>
          <Text style={styles.btnTextP}>New block</Text>
        </TouchableOpacity>
      </View>
      {blocks.length === 0 ? (
        <Text style={styles.none}>No custom blocks yet — add one above.</Text>
      ) : (
        blocks.map((key) => (
          <OverlayRow
            key={key}
            name={key}
            styles={styles}
            onOpen={() => setEditing({ kind: "block", key })}
            onDelete={() => removeBlock(key)}
          />
        ))
      )}

      <Text style={styles.section}>Your custom lists</Text>
      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newList}
          onChangeText={setNewList}
          placeholder="new list name"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.primary} onPress={createList}>
          <Text style={styles.btnTextP}>Add</Text>
        </TouchableOpacity>
      </View>
      {lists.length === 0 ? (
        <Text style={styles.none}>No custom lists yet — add one above.</Text>
      ) : (
        lists.map((name) => (
          <OverlayRow
            key={name}
            name={name}
            styles={styles}
            onOpen={() => setEditing({ kind: "list", key: name })}
            onDelete={() => removeList(name)}
          />
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    scroll: { flex: 1, padding: 16 },
    h: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 6 },
    hint: { color: T.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
    section: {
      color: T.fgSoft,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 18,
      marginBottom: 8,
    },
    newRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    newInput: {
      flex: 1,
      color: T.fg,
      fontSize: 15,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    none: { color: T.faint, fontSize: 14, textAlign: "center", marginTop: 8 },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: T.panel,
      borderRadius: T.radiusSm,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: T.borderSoft,
    },
    listName: { color: T.fgSoft, fontSize: 15, fontWeight: "600" },
    del: { color: T.dangerFg, fontSize: 13, fontWeight: "700" },
    primary: {
      backgroundColor: T.accent,
      paddingHorizontal: 18,
      borderRadius: T.radiusSm,
      alignItems: "center",
      justifyContent: "center",
    },
    btnTextP: { color: T.accentInk, fontSize: 15, fontWeight: "800" },
    editorWrap: { flex: 1 },
    editorHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    back: { color: T.accent, fontSize: 15, fontWeight: "700" },
    editorTitle: {
      color: T.fg,
      fontSize: 16,
      fontWeight: "700",
      flex: 1,
      textAlign: "center",
      marginHorizontal: 10,
    },
    save: { color: T.accent, fontSize: 15, fontWeight: "800" },
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    filter: {
      flex: 1,
      minWidth: 150,
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    status: { color: T.accent, fontSize: 12.5, paddingHorizontal: 14, paddingBottom: 8 },
    addBtn: {
      backgroundColor: T.chip,
      borderRadius: T.radiusSm,
      paddingHorizontal: 14,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: T.border,
    },
    addBtnText: { color: T.fgSoft, fontSize: 14, fontWeight: "700" },
    lineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    lineInput: {
      flex: 1,
      color: T.fg,
      fontSize: 15,
      backgroundColor: T.panel,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    lineDel: { color: T.faint, fontSize: 16, fontWeight: "700", paddingHorizontal: 4 },
  });
