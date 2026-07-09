import { ScrollView, View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { deleteImage } from "../lib/storage.js";

/** One image up close, opened from the Gallery. Detail/re-roll/resize actions grow here as image gen lands. */
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

  const w = Math.min(width, 900) - 36;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Image
        source={image.uri}
        style={{ width: w, height: w, borderRadius: 12, backgroundColor: "#1a1c22" }}
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
  scroll: { padding: 18 },
  name: { color: "#e8eaf0", fontSize: 15, marginTop: 12, marginBottom: 14 },
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: "#23262f", alignItems: "center" },
  btnText: { color: "#dbe4ff", fontSize: 15, fontWeight: "700" },
  delBtn: { backgroundColor: "#3a2226" },
  delText: { color: "#ff9aa5" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyBody: { color: "#8a90a2", fontSize: 14, lineHeight: 21, textAlign: "center" },
});
