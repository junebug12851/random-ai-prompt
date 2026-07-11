/**
 * A centered, max-width content column for tablet/wide layouts — the RN counterpart to the web's
 * `.main-col > * { max-width: 960px }` reading column. On phones it's a transparent passthrough (full
 * width, no wrapper cost); on tablet/wide it centers its child and caps the width so reading/editing
 * surfaces don't stretch edge-to-edge into a "blown-up phone." No feature is hidden — only the column
 * width changes with size. Grid surfaces (the Gallery) opt OUT and use the full width themselves.
 * @module components/ContentColumn
 */
import { View } from "react-native";
import { useResponsive } from "../lib/responsive.js";

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {number} [props.max] Max column width on tablet/wide (defaults to the responsive reading cap).
 * @param {object} [props.style] Extra style for the outer fill container.
 * @returns {JSX.Element}
 */
export default function ContentColumn({ children, max, style }) {
  const { isTabletOrWider, contentMaxWidth } = useResponsive();
  if (!isTabletOrWider) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }
  return (
    <View style={[{ flex: 1, alignItems: "center" }, style]}>
      <View style={{ flex: 1, width: "100%", maxWidth: max ?? contentMaxWidth }}>{children}</View>
    </View>
  );
}
