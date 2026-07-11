/**
 * A line-numbered monospace DPL editor for the Manage block editor — the same shape as the Generate
 * composer's code box (a gutter of line numbers beside a multiline monospace `TextInput`), extracted so
 * both surfaces share it. Controlled: `value` + `onChangeText`. No feature is lost vs. the composer's
 * editor; syntax-color layering can be added here later without touching callers.
 * @module components/DplMiniEditor
 */
import { useMemo } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme.js";

const CODE_FONT = 13;
const CODE_LH = 20;

/**
 * @param {object} props
 * @param {string} props.value Controlled DPL text.
 * @param {Function} props.onChangeText `(next)` on edits.
 * @param {string} [props.placeholder]
 * @param {number} [props.minLines] Minimum gutter lines to render (keeps the box from collapsing).
 * @returns {JSX.Element}
 */
export default function DplMiniEditor({ value, onChangeText, placeholder = "", minLines = 6 }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const lineCount = Math.max(minLines, (value ? value.split("\n").length : 1));

  return (
    <ScrollView style={styles.wrap} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      <View style={styles.row}>
        <View style={styles.gutter}>
          {Array.from({ length: lineCount }, (_, i) => (
            <Text key={i} style={styles.gutterNum}>
              {i + 1}
            </Text>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.faint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          spellCheck={false}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    wrap: {
      flexGrow: 0,
      borderWidth: 1,
      borderColor: T.border,
      borderRadius: T.radiusSm,
      backgroundColor: T.input,
    },
    row: { flexDirection: "row", padding: 8 },
    gutter: { paddingRight: 8, marginRight: 8, borderRightWidth: 1, borderRightColor: T.border },
    gutterNum: {
      color: T.faint,
      fontSize: CODE_FONT,
      lineHeight: CODE_LH,
      fontFamily: "monospace",
      textAlign: "right",
      minWidth: 22,
    },
    input: {
      flex: 1,
      color: T.fg,
      fontSize: CODE_FONT,
      lineHeight: CODE_LH,
      fontFamily: "monospace",
      padding: 0,
      minHeight: CODE_LH * 6,
    },
  });
