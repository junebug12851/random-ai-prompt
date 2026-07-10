import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { useTheme } from "../lib/theme.js";
import { deleteImage, saveImageSrc } from "../lib/storage.js";
import { getUpscaleProvider, providerDefaults } from "../lib/imageProviders.js";
import { getKey } from "../lib/keys.js";

const FS = Platform.OS === "web" ? null : require("expo-file-system/legacy");

/** One image up close, opened from the Gallery — with details, upscale (via the chosen Upscaler), and delete. */
export default function SingleScreen({ image, onBack, onDeleted, onUpscaled }) {
  const { T, upscaleProvider, providerSettings } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!image) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>No image selected</Text>
        <Text style={styles.emptyBody}>
          Open an image from the Gallery to view it up close. Details, upscale, and delete live here.
        </Text>
      </View>
    );
  }

  const up = upscaleProvider !== "none" ? getUpscaleProvider(upscaleProvider) : null;

  const doUpscale = async () => {
    if (busy) return;
    if (!up) {
      setMsg("Pick an Upscaler in the ⋯ menu first (Upscale row).");
      return;
    }
    if (!FS) return;
    setBusy(true);
    setMsg(`Upscaling with ${up.label}…`);
    try {
      const key = up.local ? "" : await getKey(up.id);
      if (!up.local && !key) {
        setMsg(`Add your ${up.label} key in the ⋯ menu to upscale.`);
        setBusy(false);
        return;
      }
      // Local upscalers reuse the image provider's server URL / model settings (same provider id).
      const settings = { ...providerDefaults(up.id), ...(providerSettings[up.id] || {}) };
      const args = { key, settings };
      if (up.mode === "dataurl") {
        const b64 = await FS.readAsStringAsync(image.uri, { encoding: FS.EncodingType.Base64 });
        args.image = `data:image/png;base64,${b64}`;
      } else if (up.mode === "base64") {
        args.imageBase64 = await FS.readAsStringAsync(image.uri, { encoding: FS.EncodingType.Base64 });
      } else {
        // "file" — RN multipart file part (upload the local file directly).
        args.imageFile = { uri: image.uri, name: "image.png", type: "image/png" };
      }
      const { images } = await up.upscale(args);
      let saved = 0;
      for (const img of images) {
        await saveImageSrc(img, {
          prompt: image.prompt,
          provider: [image.provider, up.id].filter(Boolean).join(" + "),
          model: "upscaled",
        });
        saved++;
      }
      setMsg(saved ? "Upscaled ✓ — saved to the Gallery." : "No upscaled image returned.");
      if (saved) onUpscaled?.();
    } catch (e) {
      setMsg(`Error: ${e?.message || String(e)}`);
    }
    setBusy(false);
  };

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
      {image.prompt ? (
        <Text style={styles.prompt} selectable>
          {image.prompt}
        </Text>
      ) : null}
      <Text style={styles.meta}>
        {[image.provider, image.model].filter(Boolean).join(" · ") || image.name}
      </Text>

      <TouchableOpacity
        style={[styles.upscaleBtn, (busy || !up) && styles.upscaleBtnOff]}
        onPress={doUpscale}
        disabled={busy}
        activeOpacity={0.85}
      >
        <Text style={styles.upscaleText}>
          {busy ? "Upscaling…" : up ? `Upscale · ${up.label.split(" (")[0]}` : "Upscale (pick an Upscaler in ⋯)"}
        </Text>
      </TouchableOpacity>
      {msg ? (
        <Text style={[styles.msg, msg.startsWith("Error") && styles.msgErr]}>{msg}</Text>
      ) : null}

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

const makeStyles = (T) =>
  StyleSheet.create({
    scroll: { padding: 16 },
    name: { color: T.fgSoft, fontSize: 15, marginTop: 12, marginBottom: 14 },
    prompt: { color: T.fg, fontSize: 15, lineHeight: 22, marginTop: 14 },
    meta: { color: T.muted, fontSize: 13, marginTop: 6, marginBottom: 14 },
    upscaleBtn: {
      paddingVertical: 13,
      borderRadius: T.radiusSm,
      backgroundColor: T.accent,
      alignItems: "center",
      marginBottom: 10,
    },
    upscaleBtnOff: { opacity: 0.55 },
    upscaleText: { color: T.accentInk, fontSize: 15, fontWeight: "800" },
    msg: { color: T.muted, fontSize: 13, textAlign: "center", marginBottom: 12 },
    msgErr: { color: T.dangerFg },
    actions: { flexDirection: "row", gap: 10 },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: T.radiusSm,
      backgroundColor: T.chip,
      alignItems: "center",
      borderWidth: 1,
      borderColor: T.border,
    },
    btnText: { color: T.fgSoft, fontSize: 15, fontWeight: "700" },
    delBtn: { backgroundColor: T.dangerBg, borderColor: T.dangerBorder },
    delText: { color: T.dangerFg },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyIcon: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { color: T.fg, fontSize: 18, fontWeight: "700", marginBottom: 8 },
    emptyBody: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  });
