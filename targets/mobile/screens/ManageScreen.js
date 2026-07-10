import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTheme } from "../lib/theme.js";
import {
  listUserLists,
  readUserList,
  writeUserList,
  deleteUserList,
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
      </View>
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

/**
 * Manage the phone-local user overlay: custom word lists, each a windowed editor that stays smooth to the
 * supported 100k-line max. Master/detail like the web Manage. Wiring these into the engine as a live
 * runtime overlay (so {name} draws from them during generation) is the next step.
 */
export default function ManageScreen() {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [lists, setLists] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newName, setNewName] = useState("");

  const reload = useCallback(() => {
    listUserLists().then(setLists);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async () => {
    // No `/`: writeUserList stores `${LISTS}${name}.txt` and listUserLists only scans the top-level
    // lists dir, so a `folder/list` name wouldn't round-trip. Keep names flat.
    const n = newName.trim().replace(/[^a-z0-9_-]/gi, "");
    if (!n) return;
    await writeUserList(n, "");
    setNewName("");
    reload();
    setEditing(n);
  }, [newName, reload]);
  const remove = useCallback(
    async (name) => {
      await deleteUserList(name);
      reload();
    },
    [reload],
  );

  if (editing != null) {
    return (
      <Editor
        name={editing}
        onClose={(saved) => {
          setEditing(null);
          if (saved) reload();
        }}
      />
    );
  }

  return (
    <View style={styles.scroll}>
      <Text style={styles.h}>Your custom lists</Text>
      <Text style={styles.hint}>
        Word lists stored on your phone (editor stays smooth to 100k lines). Hooking them into
        generation as a live overlay is the next step.
        {storageAvailable ? "" : " (Storage is off in the web preview.)"}
      </Text>
      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="new list name"
          placeholderTextColor={T.faint}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.primary} onPress={create}>
          <Text style={styles.btnTextP}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlashList
        data={lists}
        keyExtractor={(n) => n}
        estimatedItemSize={60}
        ListEmptyComponent={<Text style={styles.none}>No custom lists yet — add one above.</Text>}
        renderItem={({ item: name }) => (
          <View style={styles.listRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditing(name)}>
              <Text style={styles.listName}>{name}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(name)} hitSlop={8}>
              <Text style={styles.del}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    scroll: { flex: 1, padding: 16 },
    h: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 6 },
    hint: { color: T.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
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
    toolbar: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
    filter: {
      flex: 1,
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
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
