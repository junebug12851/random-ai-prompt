import { useState, useEffect, useCallback, useRef, memo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { listUserLists, readUserList, writeUserList, deleteUserList, storageAvailable } from "../lib/storage.js";

// One editable line. The input is UNCONTROLLED (defaultValue) and writes straight into the shared line
// object on change — so typing never re-renders the (up to 100k-row) list. Memoized on the line object,
// so recompute()/filter changes only touch rows whose identity actually changed.
const LineRow = memo(function LineRow({ line, onCommit, onDelete }) {
  return (
    <View style={styles.lineRow}>
      <TextInput
        style={styles.lineInput}
        defaultValue={line.text}
        onChangeText={(t) => onCommit(line, t)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="(empty)"
        placeholderTextColor="#3f4456"
      />
      <TouchableOpacity onPress={() => onDelete(line)} hitSlop={10}>
        <Text style={styles.lineDel}>✕</Text>
      </TouchableOpacity>
    </View>
  );
});

// The windowed editor for one list. Lines live in a ref (mutated in place); `view` is the filtered
// subset actually rendered. Stable per-line `id` keeps FlashList identity correct across add/delete.
function Editor({ name, onClose }) {
  const linesRef = useRef([]);
  const nextId = useRef(0);
  const dirty = useRef(false);
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
    for (let i = 0; i < all.length; i++) if (all[i].text.toLowerCase().includes(needle)) out.push(all[i]);
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
    dirty.current = true;
  }, []);
  const onDelete = useCallback(
    (line) => {
      const all = linesRef.current;
      const i = all.indexOf(line);
      if (i >= 0) all.splice(i, 1);
      dirty.current = true;
      recompute(filter);
    },
    [filter, recompute],
  );
  const add = useCallback(() => {
    linesRef.current.unshift({ id: nextId.current++, text: "" });
    dirty.current = true;
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
    dirty.current = false;
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
          placeholderTextColor="#5a607a"
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
          ready ? <Text style={styles.none}>{filter ? "No matching lines." : "Empty — add a line."}</Text> : null
        }
      />
    </View>
  );
}

/**
 * Manage the phone-local user overlay: custom word lists on the device, each a windowed editor that
 * stays smooth to the supported 100k-line max. Wiring these into the engine as a live runtime overlay
 * (so {name} draws from them during generation) is the next step.
 */
export default function ManageScreen() {
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
    const n = newName.trim().replace(/[^a-z0-9/_-]/gi, "");
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
        Word lists stored on your phone (editor stays smooth to 100k lines). Hooking them into generation
        as a live overlay is the next step.{storageAvailable ? "" : " (Storage is off in the web preview.)"}
      </Text>
      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="new list name"
          placeholderTextColor="#5a607a"
          autoCapitalize="none"
        />
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={create}>
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

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 18 },
  h: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  hint: { color: "#8a90a2", fontSize: 13, lineHeight: 19, marginBottom: 14 },
  newRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  newInput: { flex: 1, color: "#e8eaf0", fontSize: 15, backgroundColor: "#1a1c22", borderRadius: 10, borderWidth: 1, borderColor: "#2e323d", paddingHorizontal: 12, paddingVertical: 10 },
  none: { color: "#5a607a", fontSize: 14, textAlign: "center", marginTop: 8 },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a1c22", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  listName: { color: "#e8eaf0", fontSize: 15, fontWeight: "600" },
  del: { color: "#ff9aa5", fontSize: 13, fontWeight: "700" },
  primary: { backgroundColor: "#5b8cff" },
  btn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: "#23262f", alignItems: "center", justifyContent: "center" },
  btnTextP: { color: "#fff", fontSize: 15, fontWeight: "700" },
  editorWrap: { flex: 1 },
  editorHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: "#9fb4ff", fontSize: 15, fontWeight: "700" },
  editorTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center", marginHorizontal: 10 },
  save: { color: "#5b8cff", fontSize: 15, fontWeight: "700" },
  toolbar: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  filter: { flex: 1, color: "#e8eaf0", fontSize: 14, backgroundColor: "#1a1c22", borderRadius: 10, borderWidth: 1, borderColor: "#2e323d", paddingHorizontal: 12, paddingVertical: 9 },
  addBtn: { backgroundColor: "#23262f", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  addBtnText: { color: "#dbe4ff", fontSize: 14, fontWeight: "700" },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  lineInput: { flex: 1, color: "#e8eaf0", fontSize: 15, backgroundColor: "#1a1c22", borderRadius: 8, borderWidth: 1, borderColor: "#2a2d38", paddingHorizontal: 12, paddingVertical: 9 },
  lineDel: { color: "#6b7185", fontSize: 16, fontWeight: "700", paddingHorizontal: 4 },
});
