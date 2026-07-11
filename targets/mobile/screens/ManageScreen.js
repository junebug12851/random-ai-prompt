import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTheme } from "../lib/theme.js";
import { sortLines, dedupeLines } from "../lib/listOps.js";
import ManageBlockEditor from "../components/ManageBlockEditor.js";
import ManageTree from "../components/ManageTree.js";
import { refreshOverlay } from "../lib/overlay.js";
import {
  readUserList,
  writeUserList,
  deleteUserList,
  writeUserBlock,
  deleteUserBlock,
  readUserTree,
  deleteUserFolder,
  readUserSidecar,
  writeUserSidecar,
  storageAvailable,
} from "../lib/storage.js";

const EMPTY_TREE = { name: "", path: "", folders: [], entries: [] };

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
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("entries"); // "entries" | "raw"
  const [rawText, setRawText] = useState("");

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
    Promise.all([readUserList(name), readUserSidecar("lists", name)]).then(([text, meta]) => {
      const arr = text.length ? text.split("\n") : [];
      linesRef.current = arr.map((t) => ({ id: nextId.current++, text: t }));
      setView(linesRef.current.slice());
      setDescription(meta.description || "");
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
  // Entries ⇄ Raw: serialize to raw on the way in; re-parse the raw text back into rows on the way out.
  const switchMode = useCallback(
    (next) => {
      if (next === mode) return;
      if (next === "raw") {
        setRawText(linesRef.current.map((l) => l.text).join("\n"));
      } else {
        const arr = rawText.length ? rawText.split("\n") : [];
        linesRef.current = arr.map((t) => ({ id: nextId.current++, text: t }));
        recompute(filter);
      }
      setMode(next);
    },
    [mode, rawText, filter, recompute],
  );
  const save = useCallback(async () => {
    const text = mode === "raw" ? rawText : linesRef.current.map((l) => l.text).join("\n");
    await writeUserList(name, text);
    await writeUserSidecar("lists", name, { description: description.trim() || null });
    onClose(true);
  }, [name, onClose, mode, rawText, description]);

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

      <View style={styles.editorTabs}>
        <TouchableOpacity onPress={() => switchMode("entries")}>
          <Text style={[styles.editorTab, mode === "entries" && styles.editorTabOn]}>Entries</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => switchMode("raw")}>
          <Text style={[styles.editorTab, mode === "raw" && styles.editorTabOn]}>Raw</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.descRow}>
        <TextInput
          style={styles.descInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={T.faint}
        />
      </View>

      {mode === "entries" ? (
        <>
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
                <Text style={styles.none}>
                  {filter ? "No matching lines." : "Empty — add a line."}
                </Text>
              ) : null
            }
          />
        </>
      ) : (
        <TextInput
          style={styles.rawInput}
          value={rawText}
          onChangeText={setRawText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          placeholder="One entry per line"
          placeholderTextColor={T.faint}
        />
      )}
    </View>
  );
}

// Sanitize a (possibly nested) new name: clean each `folder/segment` and drop empties. The storage
// layer creates parent folders, so naming an entry `scene/dawn` puts it in a "scene" folder — the
// mobile form of the web tree's folders (no separate "new folder" button needed).
const cleanKey = (s) =>
  s
    .split("/")
    .map((seg) => seg.trim().replace(/[^a-z0-9_-]/gi, ""))
    .filter(Boolean)
    .join("/");

/**
 * Manage the phone-local user overlay — the two editable roots the web Manage exposes, to the extent the
 * platform allows: **Blocks** (custom DPL generators) and **Lists** (custom word lists), each a nested
 * folder tree (folders created implicitly by a `folder/name`), master/detail with its own editor (block
 * editor / windowed line editor, smooth to the 100k-line max). Built-in browsing, override/restore, and
 * the live runtime overlay follow (tracked in notes/plans/mobile-parity.md).
 */
export default function ManageScreen() {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [listTree, setListTree] = useState(EMPTY_TREE);
  const [blockTree, setBlockTree] = useState(EMPTY_TREE);
  const [editing, setEditing] = useState(null); // { kind: "list"|"block", key } | null
  const [newList, setNewList] = useState("");
  const [newBlock, setNewBlock] = useState("");

  const reload = useCallback(() => {
    readUserTree("blocks").then(setBlockTree);
    readUserTree("lists").then(setListTree);
    // Push edits into the engine overlay so custom content feeds generation immediately.
    refreshOverlay().catch(() => {});
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const createList = useCallback(async () => {
    const n = cleanKey(newList);
    if (!n) return;
    await writeUserList(n, "");
    setNewList("");
    reload();
    setEditing({ kind: "list", key: n });
  }, [newList, reload]);
  const createBlock = useCallback(async () => {
    const n = cleanKey(newBlock);
    if (!n) return;
    await writeUserBlock(n, "Start\n===\n");
    setNewBlock("");
    reload();
    setEditing({ kind: "block", key: n });
  }, [newBlock, reload]);

  const openEntry = useCallback((e) => {
    setEditing({ kind: e.kind === "generator" ? "block" : "list", key: e.key });
  }, []);
  const deleteBlockEntry = useCallback(
    async (e) => {
      await deleteUserBlock(e.key);
      reload();
    },
    [reload],
  );
  const deleteListEntry = useCallback(
    async (e) => {
      await deleteUserList(e.key);
      reload();
    },
    [reload],
  );
  const deleteFolder = useCallback(
    async (root, path) => {
      await deleteUserFolder(root, path);
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
        Custom DPL generators (blocks) and word lists stored on your phone — name one `folder/name` to
        nest it. Editors stay smooth to the 100k-line max.
        {storageAvailable ? "" : " (Storage is off in the web preview.)"}
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
      <ManageTree
        tree={blockTree}
        onOpen={openEntry}
        onDelete={deleteBlockEntry}
        onDeleteFolder={(path) => deleteFolder("blocks", path)}
        emptyText="No custom blocks yet — add one above."
      />

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
      <ManageTree
        tree={listTree}
        onOpen={openEntry}
        onDelete={deleteListEntry}
        onDeleteFolder={(path) => deleteFolder("lists", path)}
        emptyText="No custom lists yet — add one above."
      />
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
    editorTabs: {
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: T.border,
    },
    editorTab: {
      color: T.muted,
      fontSize: 14,
      fontWeight: "700",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    editorTabOn: { color: T.fg, borderBottomColor: T.accent },
    descRow: { paddingHorizontal: 14, paddingTop: 10 },
    descInput: {
      color: T.fg,
      fontSize: 14,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    rawInput: {
      flex: 1,
      color: T.fg,
      fontSize: 14,
      fontFamily: "monospace",
      backgroundColor: T.input,
      margin: 14,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      padding: 12,
    },
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
