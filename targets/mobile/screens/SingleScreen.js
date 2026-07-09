import { ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { T } from "../lib/theme.js";
import { deleteImage } from "../lib/storage.js";

/** One image up close, opened from the Gallery. Details/re-rolls/resizes grow here as image gen lands. */
export default function SingleScreen({ image, onBack, onDeleted }) {
  const { width } = useWindowDimensions();

  if (!image) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>No image selected</Text>
        <Text style={styles.emptyBody}>
          Open an image from the Gallery to view it up close. Details, re-rolls, and resizes will live here.
        </Text>
      </View>
    );
  }

  const w = Math.min(width, 900) - 32;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Image
        source={image.uri}
        style={{ width: w, height: w, borderRadius: T.radius, backgroundColor: T.panel }}
        contentFit="contain"
        cachePolicy="disk"
        transition={120}
      />
      <Text style={styles.name}>{image.name}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.delBtn]}
          onPress={async () => {
            await deleteImage(image.uri);
            onDeleted?.();
          }}
        >
          <Text style={[styles.btnText, styles.delText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  name: { color: T.fgSoft, fontSize: 15, marginTop: 12, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: T.radiusSm, backgroundColor: T.chip, alignItems: "center", borderWidth: 1, borderColor: T.border },
  btnText: { color: T.fgSoft, fontSize: 15, fontWeight: "700" },
  delBtn: { backgroundColor: T.dangerBg, borderColor: T.dangerBorder },
  delText: { color: T.dangerFg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyBody: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
