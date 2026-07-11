import { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from "react-native";
import { useTheme } from "../lib/theme.js";
import { ChevronDownIcon } from "../lib/icons.js";
import { DPL_INSERTS, materialize } from "../lib/dplInserts.js";
import { expandOnce } from "../lib/engine.js";

// Live re-rolling examples for the open category (keyed by item id), refreshed every 1s — like the web
// DplInsertBar. Only items with an `example` roll.
function useExamples(openCat) {
  const [examples, setExamples] = useState({});
  useEffect(() => {
    if (!openCat) {
      setExamples({});
      return undefined;
    }
    const withEx = openCat.items.filter((it) => it.example);
    if (!withEx.length) {
      setExamples({});
      return undefined;
    }
    const roll = () => {
      const next = {};
      for (const it of withEx) next[it.id] = expandOnce(it.example);
      setExamples(next);
    };
    roll();
    const id = setInterval(roll, 1000);
    return () => clearInterval(id);
  }, [openCat]);
  return examples;
}

/**
 * The DPL insert control above the prompt box — teaches + inserts the lax line grammar (structure,
 * chance, choose, repeat, flow, emphasis, code). A single "Insert ▾" button opens a bottom sheet:
 * category list → drill into a category's constructs (name + description + syntax + a live example
 * that re-rolls each second) → picking one inserts its snippet. Mirrors the web compact InsertMenu.
 * @param {{ onInsert: (text: string) => void }} props
 */
export default function InsertMenu({ onInsert }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const openCat = DPL_INSERTS.find((c) => c.key === activeKey) || null;
  const examples = useExamples(open ? openCat : null);
  const scrollRef = useRef(null);

  const close = () => {
    setOpen(false);
    setActiveKey(null);
  };
  const pick = (item) => {
    onInsert(materialize(item.template));
    close();
  };

  return (
    <>
      <TouchableOpacity accessibilityRole="button"
        style={[styles.insert, open && styles.insertOn]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.insertText}>Insert</Text>
        <ChevronDownIcon size={15} color={T.fgSoft} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.scrim}>
          <TouchableOpacity accessibilityRole="button" style={{ flex: 1 }} onPress={close} activeOpacity={1} />
          <View style={styles.sheet}>
            {!openCat ? (
              <>
                <View style={styles.head}>
                  <Text style={styles.title}>Insert DPL syntax</Text>
                  <TouchableOpacity accessibilityRole="button" onPress={close}>
                    <Text style={styles.close}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.body}>
                  {DPL_INSERTS.map((cat) => (
                    <TouchableOpacity accessibilityRole="button"
                      key={cat.key}
                      style={styles.catRow}
                      onPress={() => setActiveKey(cat.key)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catName}>{cat.label}</Text>
                        <Text style={styles.catHint}>{cat.hint}</Text>
                      </View>
                      <Text style={styles.catArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.head}>
                  <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => setActiveKey(null)}>
                    <Text style={styles.backText}>‹ {openCat.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" onPress={close}>
                    <Text style={styles.close}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
                  {openCat.items.map((it) => (
                    <TouchableOpacity accessibilityRole="button"
                      key={it.id}
                      style={styles.item}
                      onPress={() => pick(it)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.itemName}>{it.label}</Text>
                      <Text style={styles.itemDesc}>{it.desc}</Text>
                      <Text style={styles.itemSyntax}>{it.syntax}</Text>
                      {it.example && (
                        <View style={styles.exRow}>
                          <Text style={styles.exLabel}>example</Text>
                          <Text style={styles.exText}>{examples[it.id] ?? "…"}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    insert: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: T.radiusPill,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.panel,
    },
    insertOn: { borderColor: T.accent },
    insertText: { color: T.fgSoft, fontSize: 14, fontWeight: "700" },

    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      backgroundColor: T.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: "80%",
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
      borderBottomWidth: 1,
      borderBottomColor: T.borderSoft,
    },
    title: { color: T.fg, fontSize: 16, fontWeight: "800" },
    close: { color: T.muted, fontSize: 18, fontWeight: "700", paddingHorizontal: 6 },
    back: { paddingVertical: 2 },
    backText: { color: T.accent, fontSize: 15, fontWeight: "800" },
    body: { paddingHorizontal: 14, paddingVertical: 10, paddingBottom: 28 },

    catRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: T.elevated,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.borderSoft,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 8,
    },
    catName: { color: T.fg, fontSize: 15, fontWeight: "700" },
    catHint: { color: T.muted, fontSize: 12.5, marginTop: 2 },
    catArrow: { color: T.faint, fontSize: 22, fontWeight: "700", marginLeft: 10 },

    item: {
      backgroundColor: T.elevated,
      borderRadius: T.radiusSm,
      borderWidth: 1,
      borderColor: T.borderSoft,
      padding: 12,
      marginBottom: 8,
    },
    itemName: { color: T.fg, fontSize: 15, fontWeight: "700" },
    itemDesc: { color: T.muted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
    itemSyntax: { color: T.accent, fontSize: 13, fontFamily: "monospace", marginTop: 6 },
    exRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: T.borderSoft,
      paddingTop: 6,
    },
    exLabel: {
      color: T.faint,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    exText: { color: T.fgSoft, fontSize: 12.5, fontFamily: "monospace", flex: 1 },
  });
