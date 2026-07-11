/**
 * The Manage overlay **tree** for one root (Blocks or Lists) — the RN counterpart to the web Manage's
 * nested folder tree. Renders `readUserTree(root)` output: collapsible folder nodes (with entry counts +
 * a delete action) and tap-to-open entries (with a kind dot, a `JS` badge, and a delete action). Folders
 * are created implicitly by naming an entry `folder/name` (the storage layer makes parent dirs), so this
 * stays a pure presenter: it reports opens/deletes up via callbacks and owns only the expand/collapse UI.
 * @module components/ManageTree
 */
import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme.js";

function countEntries(node) {
  let n = node.entries.length;
  for (const f of node.folders) n += countEntries(f);
  return n;
}

function Entry({ entry, onOpen, onDelete, styles }) {
  return (
    <View style={styles.entryRow}>
      <TouchableOpacity accessibilityRole="button" style={styles.entryOpen} onPress={() => onOpen(entry)}>
        <View style={[styles.dot, entry.kind === "generator" ? styles.dotGen : styles.dotList]} />
        <Text style={styles.entryLabel}>{entry.label}</Text>
        {entry.hasJs ? <Text style={styles.jsBadge}>JS</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => onDelete(entry)} hitSlop={8}>
        <Text style={styles.del}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function FolderNode({ node, onOpen, onDelete, onDeleteFolder, styles, depth }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <View style={{ marginLeft: depth ? 12 : 0 }}>
      <View style={styles.folderHead}>
        <TouchableOpacity accessibilityRole="button" style={styles.folderName} onPress={() => setOpen((v) => !v)}>
          <Text style={styles.caret}>{open ? "▾" : "▸"}</Text>
          <Text style={styles.folderLabel}>{node.name}</Text>
          <Text style={styles.count}>{countEntries(node)}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => onDeleteFolder(node.path)} hitSlop={8}>
          <Text style={styles.del}>Delete</Text>
        </TouchableOpacity>
      </View>
      {open && (
        <View style={styles.folderBody}>
          {node.folders.map((f) => (
            <FolderNode
              key={f.path}
              node={f}
              onOpen={onOpen}
              onDelete={onDelete}
              onDeleteFolder={onDeleteFolder}
              styles={styles}
              depth={depth + 1}
            />
          ))}
          {node.entries.map((e) => (
            <Entry key={e.key} entry={e} onOpen={onOpen} onDelete={onDelete} styles={styles} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * @param {object} props
 * @param {{folders:Array, entries:Array}} props.tree A `readUserTree` root node.
 * @param {Function} props.onOpen `(entry)` — open an entry's editor.
 * @param {Function} props.onDelete `(entry)` — delete an entry.
 * @param {Function} props.onDeleteFolder `(folderPath)` — delete a folder (recursive).
 * @param {string} [props.emptyText] Shown when the root has no folders or entries.
 * @returns {JSX.Element}
 */
export default function ManageTree({ tree, onOpen, onDelete, onDeleteFolder, emptyText }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const empty = tree.folders.length === 0 && tree.entries.length === 0;
  if (empty) return <Text style={styles.none}>{emptyText}</Text>;
  return (
    <View>
      {tree.folders.map((f) => (
        <FolderNode
          key={f.path}
          node={f}
          onOpen={onOpen}
          onDelete={onDelete}
          onDeleteFolder={onDeleteFolder}
          styles={styles}
          depth={0}
        />
      ))}
      {tree.entries.map((e) => (
        <Entry key={e.key} entry={e} onOpen={onOpen} onDelete={onDelete} styles={styles} />
      ))}
    </View>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    none: { color: T.faint, fontSize: 14, marginBottom: 8 },
    folderHead: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    folderName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
    caret: { color: T.muted, fontSize: 12, width: 14 },
    folderLabel: { color: T.fg, fontSize: 14, fontWeight: "700" },
    count: {
      color: T.muted,
      fontSize: 11,
      fontWeight: "700",
      backgroundColor: T.chip,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 1,
      overflow: "hidden",
    },
    folderBody: { borderLeftWidth: 1, borderLeftColor: T.border, paddingLeft: 8, marginLeft: 6 },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: T.panel,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.borderSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 6,
    },
    entryOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    dotGen: { backgroundColor: T.accent },
    dotList: { backgroundColor: T.muted },
    entryLabel: { color: T.fgSoft, fontSize: 15, fontWeight: "600" },
    jsBadge: {
      color: T.accent,
      fontSize: 10,
      fontWeight: "800",
      backgroundColor: T.chip,
      borderRadius: 4,
      paddingHorizontal: 4,
      overflow: "hidden",
    },
    del: { color: T.dangerFg, fontSize: 13, fontWeight: "700" },
  });
