/**
 * The mobile Manage **block (generator) editor** — the RN counterpart to the web `ManageBlockEditor`.
 * Edits a user overlay `.dpl` generator: its DPL source (via {@link module:components/DplMiniEditor}),
 * name (rename = move), description + NSFW `.json` sidecar, and an optional `.js` sidecar (view / edit /
 * create). Saving writes the files; delete removes the generator and its sidecars. Additional web layers
 * (Insert / Refine / Modify-Draft) are tracked follow-ups reusing the Generate composer's controls.
 * @module components/ManageBlockEditor
 */
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme.js";
import DplMiniEditor from "./DplMiniEditor.js";
import InsertMenu from "./InsertMenu.js";
import {
  readUserBlock,
  writeUserBlock,
  deleteUserBlock,
  readUserBlockJs,
  writeUserBlockJs,
  readUserSidecar,
  writeUserSidecar,
  moveUserEntry,
} from "../lib/storage.js";

const JS_BOILERPLATE = `/**
 * JS sidecar for this generator. Return a string to inject (or "" to contribute nothing).
 */
export default function (settings, imageSettings, upscaleSettings) {
  return "";
}
`;

/**
 * @param {object} props
 * @param {string} props.blockKey The generator key (nested, no ext), e.g. "scene/dawn".
 * @param {Function} props.onClose `(changed)` — return to the tree; `changed` true after save/delete/rename.
 * @returns {JSX.Element}
 */
export default function ManageBlockEditor({ blockKey, onClose }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const folder = blockKey.includes("/") ? blockKey.slice(0, blockKey.lastIndexOf("/")) : "";
  const label = blockKey.slice(blockKey.lastIndexOf("/") + 1);

  const [dpl, setDpl] = useState("");
  const [js, setJs] = useState(null); // null = no sidecar
  const [name, setName] = useState(label);
  const [description, setDescription] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [tab, setTab] = useState("dpl");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, sidecar, sidecarJs] = await Promise.all([
        readUserBlock(blockKey),
        readUserSidecar("blocks", blockKey),
        readUserBlockJs(blockKey),
      ]);
      if (!alive) return;
      setDpl(d);
      setJs(sidecarJs);
      setDescription(sidecar.description || "");
      setNsfw(sidecar.nsfw === true);
      setName(label);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [blockKey, label]);

  const save = async () => {
    await writeUserBlock(blockKey, dpl);
    if (js !== null) await writeUserBlockJs(blockKey, js);
    await writeUserSidecar("blocks", blockKey, {
      description: description.trim() || null,
      nsfw: nsfw ? true : null,
    });
    setStatus("Saved");
    onClose?.(true);
  };

  const rename = async () => {
    const clean = name.trim().replace(/[^a-z0-9_-]/gi, "");
    if (!clean || clean === label) return;
    const target = folder ? `${folder}/${clean}` : clean;
    // Persist current edits first so the move carries them.
    await writeUserBlock(blockKey, dpl);
    if (js !== null) await writeUserBlockJs(blockKey, js);
    await writeUserSidecar("blocks", blockKey, {
      description: description.trim() || null,
      nsfw: nsfw ? true : null,
    });
    await moveUserEntry("blocks", blockKey, target);
    onClose?.(true);
  };

  const del = async () => {
    await deleteUserBlock(blockKey);
    onClose?.(true);
  };

  const createJs = () => {
    setJs(JS_BOILERPLATE);
    setTab("js");
  };

  return (
    <ScrollView style={styles.wrap} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => onClose?.(false)} hitSlop={8}>
          <Text style={styles.back}>‹ Blocks</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={save} hitSlop={8}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="generator name"
          placeholderTextColor={T.faint}
        />
        <Text style={styles.kind}>block</Text>
        <TouchableOpacity onPress={rename} disabled={name.trim() === label} hitSlop={8}>
          <Text style={[styles.link, name.trim() === label && styles.linkOff]}>Rename</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={styles.field}
        value={description}
        onChangeText={setDescription}
        placeholder="Editor tooltip for this block"
        placeholderTextColor={T.faint}
      />

      <TouchableOpacity style={styles.nsfwRow} onPress={() => setNsfw((v) => !v)} activeOpacity={0.7}>
        <View style={[styles.checkbox, nsfw && styles.checkboxOn]}>
          {nsfw ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.nsfwLabel}>NSFW</Text>
      </TouchableOpacity>

      {js !== null && (
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === "dpl" && styles.tabOn]} onPress={() => setTab("dpl")}>
            <Text style={[styles.tabText, tab === "dpl" && styles.tabTextOn]}>DPL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "js" && styles.tabOn]} onPress={() => setTab("js")}>
            <Text style={[styles.tabText, tab === "js" && styles.tabTextOn]}>JS sidecar</Text>
          </TouchableOpacity>
        </View>
      )}

      {ready && tab === "dpl" && (
        <>
          <View style={styles.insertRow}>
            <InsertMenu onInsert={(t) => setDpl((d) => (d ? `${d}${d.endsWith("\n") ? "" : "\n"}${t}` : t))} />
          </View>
          <DplMiniEditor value={dpl} onChangeText={setDpl} placeholder="Start&#10;===&#10;{color}" />
        </>
      )}
      {ready && tab === "js" && js !== null && (
        <DplMiniEditor value={js} onChangeText={setJs} placeholder={JS_BOILERPLATE} />
      )}

      <View style={styles.foot}>
        {js === null && (
          <TouchableOpacity onPress={createJs} hitSlop={8}>
            <Text style={styles.link}>+ Create JS sidecar</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={del} hitSlop={8}>
          <Text style={styles.danger}>Delete</Text>
        </TouchableOpacity>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    head: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    back: { color: T.accent, fontSize: 15, fontWeight: "700" },
    save: { color: T.accent, fontSize: 15, fontWeight: "800" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    nameInput: {
      flex: 1,
      color: T.fg,
      fontSize: 15,
      fontWeight: "700",
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    kind: {
      color: T.muted,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    link: { color: T.accent, fontSize: 13, fontWeight: "700" },
    linkOff: { opacity: 0.4 },
    fieldLabel: { color: T.muted, fontSize: 13, marginBottom: 4 },
    field: {
      color: T.fg,
      fontSize: 15,
      backgroundColor: T.input,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 12,
    },
    nsfwRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: T.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: T.accent, borderColor: T.accent },
    checkboxMark: { color: T.accentInk, fontSize: 12, fontWeight: "800" },
    nsfwLabel: { color: T.fgSoft, fontSize: 14 },
    tabs: { flexDirection: "row", gap: 4, borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 10 },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabOn: { borderBottomColor: T.accent },
    tabText: { color: T.muted, fontSize: 14, fontWeight: "700" },
    tabTextOn: { color: T.fg },
    insertRow: { marginBottom: 8 },
    foot: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
    danger: { color: T.dangerFg, fontSize: 13, fontWeight: "800" },
    status: { color: T.accent, fontSize: 12.5, marginTop: 10 },
  });
