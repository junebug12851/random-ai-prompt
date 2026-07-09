import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useTheme } from "../lib/theme.js";
import { listImages } from "../lib/storage.js";

/**
 * Gallery of images saved on the phone, built for the supported max load (100k). A recycling FlashList
 * over uniform square cells (the RN equivalent of the web's windowed grid) with expo-image for
 * disk-cached, memory-bounded thumbnails (recyclingKey keeps decodes correct as cells recycle).
 */
export default function GalleryScreen({ onOpen, refreshKey }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const { width } = useWindowDimensions();
  const w = Math.min(width, 900);
  const pad = 12;
  const cols = Math.max(2, Math.floor(w / 180));
  const cell = Math.floor((w - pad) / cols) - pad;

  useEffect(() => {
    let alive = true;
    listImages().then((it) => {
      if (!alive) return;
      setItems(it);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (loaded && items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🖼️</Text>
        <Text style={styles.emptyTitle}>No images yet</Text>
        <Text style={styles.emptyBody}>
          Generated images are saved here on your phone. Once image generation is wired up
          (bring-your-own provider key), every image lands in this gallery — it stays smooth up to
          100k of them.
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      key={cols}
      numColumns={cols}
      keyExtractor={(it) => it.uri}
      estimatedItemSize={cell + pad}
      contentContainerStyle={{ padding: pad / 2 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onOpen?.(item)}
          activeOpacity={0.85}
          style={{ padding: pad / 2 }}
        >
          <Image
            source={item.uri}
            style={{
              width: cell,
              height: cell,
              borderRadius: T.radiusSm,
              backgroundColor: T.panel,
            }}
            contentFit="cover"
            recyclingKey={item.uri}
            transition={120}
            cachePolicy="disk"
          />
        </TouchableOpacity>
      )}
    />
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyIcon: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 8 },
    emptyBody: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  });
